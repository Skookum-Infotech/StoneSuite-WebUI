import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/services/tenantServices', () => ({
  onboardingService: { getSetPassword: vi.fn(), setPassword: vi.fn() },
}))
vi.mock('@/api/tenantClient', () => ({
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}))

import SetPasswordPage from './SetPasswordPage'
import { onboardingService } from '@/services/tenantServices'

const TOKEN = 'tok-1'
const STRONG = 'Abcdef1!'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/onboarding/set-password?token=${TOKEN}`]}>
        <SetPasswordPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function fillAndSubmit(user: ReturnType<typeof userEvent.setup>, password: string, confirm: string) {
  await user.type(await screen.findByLabelText('Password'), password)
  await user.type(screen.getByLabelText('Confirm password'), confirm)
  await user.click(screen.getByRole('button', { name: 'Set password' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(onboardingService.getSetPassword).mockResolvedValue({
    success: true,
    valid: true,
    email: 'new.hire@acme.com',
    fullName: 'New Hire',
  })
  vi.mocked(onboardingService.setPassword).mockResolvedValue({ success: true, email: 'new.hire@acme.com' })
})

describe('SetPasswordPage password validation', () => {
  it('rejects a password with no special character and does not call the API', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillAndSubmit(user, 'Abcdefg1', 'Abcdefg1')

    expect(await screen.findByText('Must include a special character')).toBeInTheDocument()
    expect(onboardingService.setPassword).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'too short', password: 'Ab1!', message: 'Must be at least 8 characters' },
    { name: 'no uppercase', password: 'abcdefg1!', message: 'Must include an uppercase letter' },
    { name: 'no lowercase', password: 'ABCDEFG1!', message: 'Must include a lowercase letter' },
    { name: 'no number', password: 'Abcdefgh!', message: 'Must include a number' },
  ])('rejects a password that is $name', async ({ password, message }) => {
    const user = userEvent.setup()
    renderPage()
    await fillAndSubmit(user, password, password)

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(onboardingService.setPassword).not.toHaveBeenCalled()
  })

  it('rejects a confirmation that does not match', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillAndSubmit(user, STRONG, 'Abcdef1?')

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(onboardingService.setPassword).not.toHaveBeenCalled()
  })

  it('submits a strong, matching password', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillAndSubmit(user, STRONG, STRONG)

    expect(await screen.findByText(/you're all set/i)).toBeInTheDocument()
    expect(onboardingService.setPassword).toHaveBeenCalledWith(TOKEN, STRONG)
  })

  it('shows the live requirements checklist and updates it as the user types', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(await screen.findByLabelText('Password'), 'abc')

    expect(screen.getByText('One lowercase letter').closest('li')).toHaveTextContent('(met)')
    expect(screen.getByText('One special character (e.g. ! @ # $ %)').closest('li')).toHaveTextContent('(not met)')
  })
})

describe('SetPasswordPage show/hide password', () => {
  it('reveals and re-masks each password field independently', async () => {
    const user = userEvent.setup()
    renderPage()
    const password = await screen.findByLabelText('Password')
    const confirm = screen.getByLabelText('Confirm password')

    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
    expect(confirm).toHaveAttribute('type', 'password')

    await user.click(screen.getByRole('button', { name: 'Show confirmation password' }))
    expect(confirm).toHaveAttribute('type', 'text')

    await user.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(password).toHaveAttribute('type', 'password')
  })
})
