import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/services/authService', () => ({
  authService: { changePassword: vi.fn() },
}))
vi.mock('@/services/tenantServices', () => ({
  rbacService: { switchRole: vi.fn() },
}))
vi.mock('@/hooks/useUserPermissions', () => ({
  useUserPermissions: () => ({ grants: [], isLoading: false, activeRoleId: '' }),
}))
vi.mock('@/hooks/useCurrentUserRoles', () => ({
  useCurrentUserRoles: () => [],
}))
vi.mock('@/api/tenantClient', () => ({
  apiErrorMessage: (_e: unknown, fallback: string) => fallback,
}))

import AccountSettingsPage from './AccountSettingsPage'
import { authService } from '@/services/authService'

const CURRENT = 'OldPass1!'
const STRONG = 'Abcdef1!'

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <AccountSettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function openPasswordTab(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Password' }))
}

async function fillAndSubmit(
  user: ReturnType<typeof userEvent.setup>,
  { current = CURRENT, next, confirm }: { current?: string; next: string; confirm: string },
) {
  await openPasswordTab(user)
  await user.type(screen.getByLabelText('Current Password'), current)
  await user.type(screen.getByLabelText('New Password'), next)
  await user.type(screen.getByLabelText('Confirm Password'), confirm)
  await user.click(screen.getByRole('button', { name: 'Update Password' }))
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(authService.changePassword).mockResolvedValue({ success: true, message: 'ok' })
})

describe('AccountSettingsPage new-password validation', () => {
  it('rejects a new password with no special character and does not call the API', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillAndSubmit(user, { next: 'Abcdefg1', confirm: 'Abcdefg1' })

    expect(await screen.findByText('Must include a special character')).toBeInTheDocument()
    expect(authService.changePassword).not.toHaveBeenCalled()
  })

  it.each([
    { name: 'too short', password: 'Ab1!', message: 'Must be at least 8 characters' },
    { name: 'no uppercase', password: 'abcdefg1!', message: 'Must include an uppercase letter' },
    { name: 'no lowercase', password: 'ABCDEFG1!', message: 'Must include a lowercase letter' },
    { name: 'no number', password: 'Abcdefgh!', message: 'Must include a number' },
  ])('rejects a new password that is $name', async ({ password, message }) => {
    const user = userEvent.setup()
    renderPage()
    await fillAndSubmit(user, { next: password, confirm: password })

    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(authService.changePassword).not.toHaveBeenCalled()
  })

  it('rejects a confirmation that does not match', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillAndSubmit(user, { next: STRONG, confirm: 'Abcdef1?' })

    expect(await screen.findByText('Passwords do not match')).toBeInTheDocument()
    expect(authService.changePassword).not.toHaveBeenCalled()
  })

  it('rejects a new password identical to the current one', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillAndSubmit(user, { current: STRONG, next: STRONG, confirm: STRONG })

    expect(
      await screen.findByText('New password must be different from your current password'),
    ).toBeInTheDocument()
    expect(authService.changePassword).not.toHaveBeenCalled()
  })

  it('submits a strong, matching password', async () => {
    const user = userEvent.setup()
    renderPage()
    await fillAndSubmit(user, { next: STRONG, confirm: STRONG })

    expect(await screen.findByText('Password updated')).toBeInTheDocument()
    expect(authService.changePassword).toHaveBeenCalledWith(CURRENT, STRONG)
  })
})

describe('AccountSettingsPage password requirements', () => {
  it('lists the special character as required, not "recommended"', async () => {
    const user = userEvent.setup()
    renderPage()
    await openPasswordTab(user)

    expect(screen.getByText('One special character (e.g. ! @ # $ %)')).toBeInTheDocument()
    expect(screen.queryByText(/recommended/i)).not.toBeInTheDocument()
  })

  it('ticks requirements off live as the new password is typed', async () => {
    const user = userEvent.setup()
    renderPage()
    await openPasswordTab(user)
    await user.type(screen.getByLabelText('New Password'), 'Abc1')

    expect(screen.getByText('One uppercase letter').closest('li')).toHaveTextContent('(met)')
    expect(screen.getByText('One number').closest('li')).toHaveTextContent('(met)')
    expect(screen.getByText('At least 8 characters').closest('li')).toHaveTextContent('(not met)')
    expect(screen.getByText('One special character (e.g. ! @ # $ %)').closest('li')).toHaveTextContent('(not met)')
  })
})

describe('AccountSettingsPage show/hide password', () => {
  it('gives each of the three password fields its own eye toggle', async () => {
    const user = userEvent.setup()
    renderPage()
    await openPasswordTab(user)

    const fields = [
      { input: 'Current Password', toggle: 'current password' },
      { input: 'New Password', toggle: 'new password' },
      { input: 'Confirm Password', toggle: 'confirmation password' },
    ]
    for (const { input, toggle } of fields) {
      const field = screen.getByLabelText(input)
      expect(field).toHaveAttribute('type', 'password')

      await user.click(screen.getByRole('button', { name: `Show ${toggle}` }))
      expect(field).toHaveAttribute('type', 'text')

      await user.click(screen.getByRole('button', { name: `Hide ${toggle}` }))
      expect(field).toHaveAttribute('type', 'password')
    }
  })
})
