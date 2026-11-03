import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('@/services/tenantServices', () => ({
  userService: { setUsersMfa: vi.fn(), updateUser: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }))
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }))

import { BulkConfigPanel } from './BulkConfigPanel'
import { userService } from '@/services/tenantServices'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { useAuthStore } from '@/store/useAuthStore'
import { toast } from 'sonner'
import type { WorkspaceUser } from '@/types/tenant'

const ME = 'identity-me'

function member(id: string, over: Partial<WorkspaceUser> = {}): WorkspaceUser {
  return {
    id,
    identityId: `identity-${id}`,
    email: `${id}@example.com`,
    fullName: id.toUpperCase(),
    status: 'active',
    createdAt: '',
    updatedAt: '',
    roles: [],
    mfaEnabled: false,
    mfaAvailable: true,
    ...over,
  }
}

function permissions(isSuperAdmin: boolean, canUpdate = true) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    hasPermission: () => canUpdate,
    isSuperAdmin,
    isLoading: false,
    activeRoleId: null,
  } as unknown as ReturnType<typeof useUserPermissions>)
}

function renderPanel(users: WorkspaceUser[] = [member('a'), member('b')]) {
  const handlers = { onRemove: vi.fn(), onClear: vi.fn(), onBack: vi.fn() }
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <BulkConfigPanel users={users} {...handlers} />
    </QueryClientProvider>,
  )
  return handlers
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: { id: ME, email: 'me@example.com', fullName: 'Me' } })
  permissions(true)
})

describe('BulkConfigPanel', () => {
  it('lists who is selected and how many already have two-step', () => {
    renderPanel([member('a'), member('b', { mfaEnabled: true })])

    expect(screen.getByRole('heading', { name: 'Configure 2 users' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Selected users' })).toHaveTextContent('A')
    expect(screen.getByText('1 of 2 have it on')).toBeInTheDocument()
  })

  it('shows how many each action reaches', () => {
    renderPanel([member('a'), member('b', { mfaEnabled: true }), member('c', { status: 'suspended' })])

    expect(screen.getByRole('button', { name: 'Turn on two-step verification for 2 selected' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Turn off two-step verification for 1 selected' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Suspend access for 2 selected' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Restore access for 1 selected' })).toBeEnabled()
  })

  it('greys out an action nothing selected needs', () => {
    renderPanel([member('a')])

    expect(screen.getByRole('button', { name: 'Turn off two-step verification for 0 selected' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Restore access for 0 selected' })).toBeDisabled()
  })

  it('leaves out two-step for someone who is not a super admin', () => {
    permissions(false)
    renderPanel()

    expect(screen.queryByRole('region', { name: 'Two-step verification' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Suspend access for 2 selected' })).toBeInTheDocument()
  })

  it('removes one member from the selection from their chip', async () => {
    const user = userEvent.setup()
    const { onRemove } = renderPanel()

    await user.click(screen.getByRole('button', { name: 'Remove A from selection' }))

    expect(onRemove).toHaveBeenCalledWith('a')
  })

  it('previews who is affected and skipped, then turns two-step on in one request', async () => {
    const user = userEvent.setup()
    vi.mocked(userService.setUsersMfa).mockResolvedValue([{ userId: 'a', status: 'changed' }])
    const { onClear } = renderPanel([member('a'), member('b', { mfaEnabled: true }), member('c', { mfaAvailable: false })])

    await user.click(screen.getByRole('button', { name: 'Turn on two-step verification for 1 selected' }))
    expect(screen.getByText(/Turn on two-step verification for 1 user\?/)).toBeInTheDocument()
    expect(screen.getByText('B — already that way')).toBeInTheDocument()
    expect(screen.getByText('C — single sign-on')).toBeInTheDocument()
    expect(userService.setUsersMfa).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Confirm bulk action' }))

    await vi.waitFor(() => expect(userService.setUsersMfa).toHaveBeenCalledWith(['a'], true))
    await vi.waitFor(() => expect(toast.success).toHaveBeenCalled())
    expect(vi.mocked(toast.success).mock.calls[0][0]).toBe('Two-step verification turned on for 1 user')
    expect(onClear).toHaveBeenCalled()
  })

  it('does nothing when the confirm is cancelled', async () => {
    const user = userEvent.setup()
    const { onClear } = renderPanel()

    await user.click(screen.getByRole('button', { name: 'Suspend access for 2 selected' }))
    await user.click(screen.getByRole('button', { name: 'Cancel bulk action' }))

    expect(userService.updateUser).not.toHaveBeenCalled()
    expect(onClear).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Suspend access for 2 selected' })).toBeInTheDocument()
  })

  it('never includes you', async () => {
    const user = userEvent.setup()
    vi.mocked(userService.updateUser).mockResolvedValue({} as WorkspaceUser)
    renderPanel([member('a'), member('me', { identityId: ME })])

    await user.click(screen.getByRole('button', { name: 'Suspend access for 1 selected' }))
    expect(screen.getByText('ME — you')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm bulk action' }))

    await vi.waitFor(() => expect(userService.updateUser).toHaveBeenCalledTimes(1))
    expect(userService.updateUser).toHaveBeenCalledWith('a', { status: 'suspended' })
  })

  it('names who could not be suspended when only some go through', async () => {
    const user = userEvent.setup()
    vi.mocked(userService.updateUser)
      .mockResolvedValueOnce({} as WorkspaceUser)
      .mockRejectedValueOnce(new Error('Cannot suspend the last active super admin.'))
    renderPanel()

    await user.click(screen.getByRole('button', { name: 'Suspend access for 2 selected' }))
    await user.click(screen.getByRole('button', { name: 'Confirm bulk action' }))

    await vi.waitFor(() => expect(toast.warning).toHaveBeenCalled())
    const [title, options] = vi.mocked(toast.warning).mock.calls[0]
    expect(title).toBe('Access suspended for 1 of 2')
    expect(options?.description).toContain('B:')
  })

  it('keeps the selection and shows an error when the whole request is refused', async () => {
    const user = userEvent.setup()
    vi.mocked(userService.setUsersMfa).mockRejectedValue(new Error('Forbidden'))
    const { onClear } = renderPanel()

    await user.click(screen.getByRole('button', { name: 'Turn on two-step verification for 2 selected' }))
    await user.click(screen.getByRole('button', { name: 'Confirm bulk action' }))

    await vi.waitFor(() => expect(toast.error).toHaveBeenCalled())
    expect(onClear).not.toHaveBeenCalled()
  })
})
