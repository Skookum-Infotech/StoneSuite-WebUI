import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/services/tenantServices', () => ({
  userService: {
    listUsers: vi.fn(),
    listInvites: vi.fn(),
    updateUser: vi.fn(),
    setUsersMfa: vi.fn(),
    deactivateUser: vi.fn(),
  },
  rbacService: { listRoles: vi.fn() },
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }))
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }))

import UsersPage from './UsersPage'
import { userService, rbacService } from '@/services/tenantServices'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { useAuthStore } from '@/store/useAuthStore'
import type { WorkspaceUser } from '@/types/tenant'

function member(id: string, over: Partial<WorkspaceUser> = {}): WorkspaceUser {
  return {
    id,
    identityId: `identity-${id}`,
    email: `${id}@example.com`,
    fullName: id.toUpperCase(),
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    roles: [],
    mfaEnabled: false,
    mfaAvailable: true,
    ...over,
  }
}

function permissions(over: { isSuperAdmin?: boolean; canUpdate?: boolean } = {}) {
  const { isSuperAdmin = true, canUpdate = true } = over
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    hasPermission: (_resource: string, action: string) => action !== 'update' || canUpdate,
    isSuperAdmin,
    isLoading: false,
    activeRoleId: null,
  } as unknown as ReturnType<typeof useUserPermissions>)
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <UsersPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  useAuthStore.setState({ user: { id: 'identity-me', email: 'me@example.com', fullName: 'Me' } })
  vi.mocked(userService.listInvites).mockResolvedValue([])
  vi.mocked(rbacService.listRoles).mockResolvedValue([])
  vi.mocked(userService.listUsers).mockResolvedValue([
    member('me', { identityId: 'identity-me' }),
    member('a'),
    member('b', { mfaEnabled: true }),
    member('gone', { status: 'disabled' }),
  ])
  permissions()
})

describe('UsersPage — picking several members', () => {
  it('offers a checkbox for others but not for you or a deactivated account', async () => {
    renderPage()

    expect(await screen.findByRole('checkbox', { name: 'Select A' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select B' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Select ME' })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Select GONE' })).not.toBeInTheDocument()
  })

  it('opens the Configure panel on the right once someone is ticked, and closes it when cleared', async () => {
    const user = userEvent.setup()
    renderPage()

    expect(screen.queryByRole('heading', { name: /Configure/ })).not.toBeInTheDocument()
    await user.click(await screen.findByRole('checkbox', { name: 'Select A' }))

    expect(screen.getByRole('heading', { name: 'Configure 1 user' })).toBeInTheDocument()
    expect(screen.getByText('1 selected')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Clear selection' }))
    expect(screen.queryByRole('heading', { name: /Configure/ })).not.toBeInTheDocument()
  })

  it("swaps to one member's profile when they are opened, and back with Configure", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('checkbox', { name: 'Select A' }))
    await user.click(screen.getByRole('button', { name: 'Open B' }))

    expect(screen.queryByRole('heading', { name: /Configure/ })).not.toBeInTheDocument()
    expect(screen.getByRole('switch', { name: 'Two-step verification for B' })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select A' })).toBeChecked()

    await user.click(screen.getByRole('button', { name: 'Configure 1 selected' }))
    expect(screen.getByRole('heading', { name: 'Configure 1 user' })).toBeInTheDocument()
  })

  it("shows the two-step switch in a member's own profile for a super admin", async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('button', { name: 'Open A' }))

    expect(await screen.findByRole('switch', { name: 'Two-step verification for A' })).toBeInTheDocument()
  })

  it('selects everyone who can be changed with "Select all"', async () => {
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('checkbox', { name: 'Select all members' }))

    expect(screen.getByText('2 selected')).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Select A' })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: 'Select B' })).toBeChecked()
  })

  it('marks who has two-step on in the list', async () => {
    renderPage()

    await screen.findByRole('checkbox', { name: 'Select B' })
    expect(screen.getAllByRole('img', { name: 'Two-step verification is on' })).toHaveLength(1)
  })

  it('keeps two-step actions for super admins', async () => {
    permissions({ isSuperAdmin: false, canUpdate: true })
    const user = userEvent.setup()
    renderPage()

    await user.click(await screen.findByRole('checkbox', { name: 'Select A' }))

    expect(screen.getByRole('button', { name: 'Suspend access for 1 selected' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /two-step/ })).not.toBeInTheDocument()
  })

  it('offers no selection to someone who cannot change users', async () => {
    permissions({ isSuperAdmin: false, canUpdate: false })
    renderPage()

    await screen.findByRole('button', { name: 'Open A' })
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
  })
})
