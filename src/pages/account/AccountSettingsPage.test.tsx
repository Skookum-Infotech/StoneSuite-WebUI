import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/services/authService', () => ({
  authService: { changePassword: vi.fn(), updateMyName: vi.fn() },
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
import { useAuthStore } from '@/store/useAuthStore'

const CURRENT = 'OldPass1!'
const STRONG = 'Abcdef1!'
const SIGNED_IN = { id: 'identity-1', email: 'ada@example.com', fullName: 'Ada Lovelace' }

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
  vi.mocked(authService.updateMyName).mockResolvedValue({ success: true })
  useAuthStore.setState({ user: { ...SIGNED_IN } })
})

describe('AccountSettingsPage profile name', () => {
  const firstNameInput = () => screen.getByLabelText('First Name')
  const lastNameInput = () => screen.getByLabelText('Last Name')
  const saveButton = () => screen.getByRole('button', { name: 'Save Changes' })
  const editButton = () => screen.getByRole('button', { name: 'Edit name' })
  const cancelButton = () => screen.getByRole('button', { name: 'Cancel editing' })
  const startEditing = (user: ReturnType<typeof userEvent.setup>) => user.click(editButton())

  it('shows the name and email locked, with an Edit button and no Save', () => {
    renderPage()

    expect(firstNameInput()).toHaveValue('Ada')
    expect(lastNameInput()).toHaveValue('Lovelace')
    expect(firstNameInput()).toHaveAttribute('readonly')
    expect(lastNameInput()).toHaveAttribute('readonly')
    // Only the two name fields are inputs; the email is a locked display.
    expect(screen.getAllByRole('textbox')).toHaveLength(2)
    expect(screen.getAllByText('ada@example.com').length).toBeGreaterThan(0)
    expect(editButton()).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument()
  })

  it('does not let the name change until Edit is clicked', async () => {
    const user = userEvent.setup()
    renderPage()
    await user.type(lastNameInput(), 'xyz')

    expect(lastNameInput()).toHaveValue('Lovelace')
    expect(authService.updateMyName).not.toHaveBeenCalled()
  })

  it('unlocks the names, swaps Edit for Cancel/Save, and focuses the first name on Edit', async () => {
    const user = userEvent.setup()
    renderPage()
    await startEditing(user)

    expect(firstNameInput()).not.toHaveAttribute('readonly')
    expect(lastNameInput()).not.toHaveAttribute('readonly')
    expect(firstNameInput()).toHaveFocus()
    expect(cancelButton()).toBeInTheDocument()
    expect(saveButton()).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Edit name' })).not.toBeInTheDocument()
  })

  it('keeps Save disabled until the name actually changes', async () => {
    const user = userEvent.setup()
    renderPage()
    await startEditing(user)
    expect(saveButton()).toBeDisabled()

    await user.type(lastNameInput(), 'x')
    expect(saveButton()).toBeEnabled()

    await user.type(lastNameInput(), '{Backspace}')
    expect(saveButton()).toBeDisabled()
  })

  it('Cancel discards the edit, restores the saved name, and locks the fields again', async () => {
    const user = userEvent.setup()
    renderPage()
    await startEditing(user)
    await user.clear(lastNameInput())
    await user.type(lastNameInput(), 'Byron')
    await user.click(cancelButton())

    expect(lastNameInput()).toHaveValue('Lovelace')
    expect(lastNameInput()).toHaveAttribute('readonly')
    expect(editButton()).toBeInTheDocument()
    expect(authService.updateMyName).not.toHaveBeenCalled()
    expect(useAuthStore.getState().user?.fullName).toBe('Ada Lovelace')
  })

  it('saves the joined name, updates the signed-in profile, and locks the fields again', async () => {
    const user = userEvent.setup()
    renderPage()
    await startEditing(user)
    await user.clear(lastNameInput())
    await user.type(lastNameInput(), 'Byron')
    await user.click(saveButton())

    expect(await screen.findByText('Name updated')).toBeInTheDocument()
    expect(authService.updateMyName).toHaveBeenCalledWith('Ada Byron')
    expect(useAuthStore.getState().user?.fullName).toBe('Ada Byron')
    expect(lastNameInput()).toHaveValue('Byron')
    expect(lastNameInput()).toHaveAttribute('readonly')
    expect(screen.queryByRole('button', { name: 'Save Changes' })).not.toBeInTheDocument()
    expect(editButton()).toBeInTheDocument()
  })

  it('trims what it sends', async () => {
    const user = userEvent.setup()
    renderPage()
    await startEditing(user)
    await user.clear(firstNameInput())
    await user.type(firstNameInput(), '  Augusta  ')
    await user.click(saveButton())

    await screen.findByText('Name updated')
    expect(authService.updateMyName).toHaveBeenCalledWith('Augusta Lovelace')
  })

  it('allows a blank last name and sends just the first name', async () => {
    const user = userEvent.setup()
    renderPage()
    await startEditing(user)
    await user.clear(lastNameInput())
    await user.click(saveButton())

    await screen.findByText('Name updated')
    expect(authService.updateMyName).toHaveBeenCalledWith('Ada')
  })

  it('rejects a blank first name without calling the API', async () => {
    const user = userEvent.setup()
    renderPage()
    await startEditing(user)
    await user.clear(firstNameInput())
    await user.click(saveButton())

    expect(await screen.findByText('First name is required')).toBeInTheDocument()
    expect(authService.updateMyName).not.toHaveBeenCalled()
  })

  it('shows a failure and leaves the signed-in profile alone when the save fails', async () => {
    vi.mocked(authService.updateMyName).mockRejectedValue(new Error('boom'))
    const user = userEvent.setup()
    renderPage()
    await startEditing(user)
    await user.clear(lastNameInput())
    await user.type(lastNameInput(), 'Byron')
    await user.click(saveButton())

    expect(await screen.findByText('Failed to update name')).toBeInTheDocument()
    expect(screen.queryByText('Name updated')).not.toBeInTheDocument()
    expect(useAuthStore.getState().user?.fullName).toBe('Ada Lovelace')
    // Still editing and still dirty, so the user can retry without retyping.
    expect(lastNameInput()).not.toHaveAttribute('readonly')
    expect(saveButton()).toBeEnabled()
  })
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
