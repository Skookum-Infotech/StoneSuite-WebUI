import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/services/authService', () => ({
  authService: { validateResetToken: vi.fn(), resetPassword: vi.fn() },
}))
vi.mock('@/api/tenantClient', () => ({
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}))

import ResetPasswordPage from './ResetPasswordPage'
import { authService } from '@/services/authService'

const TOKEN = 'tok-1'
const STRONG = 'Abcdef1!'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/auth/reset-password?token=${TOKEN}`]}>
        <ResetPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, password: string, confirm: string) {
  await user.type(await screen.findByLabelText('New Password'), password)
  await user.type(screen.getByLabelText('Confirm Password'), confirm)
  await user.click(screen.getByRole('button', { name: /set new password/i }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authService.validateResetToken).mockResolvedValue({ success: true, valid: true, email: 'user@acme.com' })
  vi.mocked(authService.resetPassword).mockResolvedValue({ success: true, message: 'ok' })
})

describe('ResetPasswordPage password validation', () => {
  it('rejects a password with no special character and does not call the API', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillAndSubmit(user, 'Abcdefg1', 'Abcdefg1')

    expect(await screen.findByText('Must include a special character')).toBeInTheDocument()
    expect(authService.resetPassword).not.toHaveBeenCalled()
  })

  it('rejects a password with no lowercase letter', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillAndSubmit(user, 'ABCDEFG1!', 'ABCDEFG1!')

    expect(await screen.findByText('Must include a lowercase letter')).toBeInTheDocument()
    expect(authService.resetPassword).not.toHaveBeenCalled()
  })

  it('submits a strong, matching password', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillAndSubmit(user, STRONG, STRONG)

    expect(await screen.findByText('Password updated')).toBeInTheDocument()
    expect(authService.resetPassword).toHaveBeenCalledWith(TOKEN, STRONG)
  })

  it('shows the live requirements checklist', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByLabelText('New Password'), 'abc')

    expect(screen.getByText('One lowercase letter').closest('li')).toHaveTextContent('(met)')
    expect(screen.getByText('One special character (e.g. ! @ # $ %)').closest('li')).toHaveTextContent('(not met)')
  })

  it('only calls a password Strong once it satisfies every rule', async () => {
    const user = userEvent.setup()
    renderPage()
    const field = await screen.findByLabelText('New Password')

    // Upper + number + special + length but no lowercase: the old 4-factor meter said "Strong".
    await user.type(field, 'ABCDEFG1!')
    expect(screen.queryByText('Strong')).not.toBeInTheDocument()

    await user.clear(field)
    await user.type(field, STRONG)
    expect(screen.getByText('Strong')).toBeInTheDocument()
  })
})
