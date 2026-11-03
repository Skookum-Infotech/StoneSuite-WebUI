import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/services/tenantServices', () => ({
  userService: { setUsersMfa: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }))

import { TwoStepAdminToggle } from './TwoStepAdminToggle'
import { userService } from '@/services/tenantServices'
import { useAuthStore } from '@/store/useAuthStore'
import { toast } from 'sonner'
import type { WorkspaceUser } from '@/types/tenant'

function member(over: Partial<WorkspaceUser> = {}): WorkspaceUser {
  return {
    id: 'u1',
    identityId: 'identity-u1',
    email: 'sam@example.com',
    fullName: 'Sam Stone',
    status: 'active',
    createdAt: '',
    updatedAt: '',
    roles: [],
    mfaEnabled: false,
    mfaAvailable: true,
    ...over,
  }
}

const toggle = () => screen.getByRole('switch', { name: 'Two-step verification for Sam Stone' })

function renderToggle(user: WorkspaceUser) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <TwoStepAdminToggle user={user} />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: { id: 'identity-me', email: 'me@example.com', fullName: 'Me' } })
})

describe('TwoStepAdminToggle', () => {
  it('shows the member\'s current setting', () => {
    renderToggle(member({ mfaEnabled: true }))

    expect(toggle()).toBeChecked()
    expect(screen.getByText(/asked for a code emailed to them/)).toBeInTheDocument()
  })

  it('turns it on for them and says so', async () => {
    const user = userEvent.setup()
    vi.mocked(userService.setUsersMfa).mockResolvedValue([{ userId: 'u1', status: 'changed' }])
    renderToggle(member())

    await user.click(toggle())

    await vi.waitFor(() => expect(userService.setUsersMfa).toHaveBeenCalledWith(['u1'], true))
    await vi.waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith('Two-step verification turned on for Sam Stone'),
    )
  })

  it('turns it off the same way', async () => {
    const user = userEvent.setup()
    vi.mocked(userService.setUsersMfa).mockResolvedValue([{ userId: 'u1', status: 'changed' }])
    renderToggle(member({ mfaEnabled: true }))

    await user.click(toggle())

    await vi.waitFor(() => expect(userService.setUsersMfa).toHaveBeenCalledWith(['u1'], false))
  })

  it('shows why when the server skipped them', async () => {
    const user = userEvent.setup()
    vi.mocked(userService.setUsersMfa).mockResolvedValue([
      { userId: 'u1', status: 'skipped', reason: 'mfa_unavailable' },
    ])
    renderToggle(member())

    await user.click(toggle())

    expect(await screen.findByRole('alert')).toHaveTextContent('skipped (mfa_unavailable)')
    expect(toast.success).not.toHaveBeenCalled()
  })

  it('shows the error when the request is refused', async () => {
    const user = userEvent.setup()
    vi.mocked(userService.setUsersMfa).mockRejectedValue(new Error('offline'))
    renderToggle(member())

    await user.click(toggle())

    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })

  it('does not let you change your own here', () => {
    renderToggle(member({ identityId: 'identity-me' }))

    expect(toggle()).toBeDisabled()
    expect(screen.getByText('Manage your own in Account Settings.')).toBeInTheDocument()
  })

  it('is off the table for a single-sign-on member', () => {
    renderToggle(member({ mfaAvailable: false }))

    expect(toggle()).toBeDisabled()
    expect(screen.getByText(/single sign-on/)).toBeInTheDocument()
  })

  it('says so, with the switch off, against a backend that does not report the setting', () => {
    renderToggle(member({ mfaEnabled: undefined }))

    expect(toggle()).toBeDisabled()
    expect(screen.getByText(/didn't report this setting/)).toBeInTheDocument()
  })
})
