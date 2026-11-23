import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/tenantServices', () => ({ rbacService: { myPermissions: vi.fn() } }));
vi.mock('@/store/useAuthStore', () => ({ useAuthStore: vi.fn() }));

import { useCurrentUserRoles } from './useCurrentUserRoles';
import { useUserPermissions } from './useUserPermissions';
import { invalidateUserRoleQueries } from '@/lib/userRoleQueries';
import { rbacService } from '@/services/tenantServices';
import { useAuthStore } from '@/store/useAuthStore';

type Role = { id: string; key: string; name: string };

const loginSnapshot: Role[] = [{ id: 'r-old', key: 'sales', name: 'Sales' }];
const serverRoles: Role[] = [
  { id: 'r-old', key: 'sales', name: 'Sales' },
  { id: 'r-new', key: 'manager', name: 'Manager' },
];

function mockSession(snapshotRoles?: Role[]) {
  const state = { isAuthenticated: true, user: { id: 'u1', roles: snapshotRoles }, kind: 'staff' };
  vi.mocked(useAuthStore).mockImplementation(((selector: (s: typeof state) => unknown) => selector(state)) as never);
}

function mockPermissions(roles?: Role[]) {
  vi.mocked(rbacService.myPermissions).mockResolvedValue({ grants: [], activeRoleId: '', roles } as never);
}

function newQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderRoles(queryClient = newQueryClient()) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useCurrentUserRoles(), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession();
});

describe('useCurrentUserRoles', () => {
  it('serves the login-time snapshot while the server response is still loading', () => {
    mockSession(loginSnapshot);
    vi.mocked(rbacService.myPermissions).mockReturnValue(new Promise(() => undefined) as never);
    const { result } = renderRoles();

    expect(result.current).toEqual(loginSnapshot);
  });

  it('prefers the server roles over the login snapshot once loaded', async () => {
    mockSession(loginSnapshot);
    mockPermissions(serverRoles);
    const { result } = renderRoles();

    await waitFor(() => expect(result.current).toEqual(serverRoles));
  });

  it('reflects a removal: an empty server list beats a non-empty snapshot', async () => {
    mockSession(loginSnapshot);
    mockPermissions([]);
    const { result } = renderRoles();

    await waitFor(() => expect(result.current).toEqual([]));
  });

  it('falls back to the snapshot when the server response carries no roles (older backend)', async () => {
    mockSession(loginSnapshot);
    mockPermissions(undefined);
    const { result } = renderRoles();

    await waitFor(() => expect(rbacService.myPermissions).toHaveBeenCalled());
    expect(result.current).toEqual(loginSnapshot);
  });

  it('is an empty list when there is neither a server response nor a snapshot', async () => {
    mockPermissions(undefined);
    const { result } = renderRoles();

    await waitFor(() => expect(rbacService.myPermissions).toHaveBeenCalled());
    expect(result.current).toEqual([]);
  });

  it('updates in place when a role is assigned mid-session and the query is invalidated', async () => {
    mockSession(loginSnapshot);
    mockPermissions(loginSnapshot);
    const queryClient = newQueryClient();
    const { result } = renderRoles(queryClient);
    await waitFor(() => expect(result.current).toEqual(loginSnapshot));

    // The admin assigns the signed-in user a second role, then the mutation's
    // onSuccess runs the shared invalidation.
    mockPermissions(serverRoles);
    await invalidateUserRoleQueries(queryClient);

    await waitFor(() => expect(result.current).toEqual(serverRoles));
  });

  it('shares one request with useUserPermissions rather than fetching twice', async () => {
    mockPermissions(serverRoles);
    const queryClient = newQueryClient();
    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
    const { result } = renderHook(() => ({ roles: useCurrentUserRoles(), perms: useUserPermissions() }), { wrapper });

    await waitFor(() => expect(result.current.roles).toEqual(serverRoles));
    expect(rbacService.myPermissions).toHaveBeenCalledTimes(1);
  });
});
