import type { ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/tenantServices', () => ({ rbacService: { myPermissions: vi.fn() } }));
vi.mock('@/store/useAuthStore', () => ({ useAuthStore: vi.fn() }));

import { useUserPermissions } from './useUserPermissions';
import { rbacService } from '@/services/tenantServices';
import { useAuthStore } from '@/store/useAuthStore';

type Grant = { resource: string; action: string; scope: string };

function mockSession(kind: 'staff' | 'portal') {
  const state = { isAuthenticated: true, user: { id: 'u1' }, kind };
  vi.mocked(useAuthStore).mockImplementation(((selector: (s: typeof state) => unknown) => selector(state)) as never);
}

function mockGrants(grants: Grant[]) {
  vi.mocked(rbacService.myPermissions).mockResolvedValue({ grants, activeRoleId: '' } as never);
}

function renderPermissions() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
  return renderHook(() => useUserPermissions(), { wrapper });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSession('staff');
});

describe('useUserPermissions().isSuperAdmin', () => {
  it('is true for the literal *:* grant, once the grants have loaded', async () => {
    mockGrants([{ resource: '*', action: '*', scope: 'all' }]);
    const { result } = renderPermissions();

    // Fails closed while loading: an admin-only control must not flash up.
    expect(result.current.isSuperAdmin).toBe(false);
    await waitFor(() => expect(result.current.isSuperAdmin).toBe(true));
  });

  it.each([
    ['a role with only specific grants', [{ resource: 'purchase_order', action: 'transition', scope: 'all' }]],
    ['a wildcard resource with a specific action', [{ resource: '*', action: 'read', scope: 'all' }]],
    ['a specific resource with a wildcard action', [{ resource: 'purchase_order', action: '*', scope: 'all' }]],
    ['no grants at all', []],
  ])('is false for %s', async (_label, grants) => {
    mockGrants(grants);
    const { result } = renderPermissions();

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isSuperAdmin).toBe(false);
  });

  it('is never true for a customer-portal session, which loads no grants', () => {
    mockSession('portal');
    mockGrants([{ resource: '*', action: '*', scope: 'all' }]);
    const { result } = renderPermissions();

    expect(result.current.isSuperAdmin).toBe(false);
    expect(rbacService.myPermissions).not.toHaveBeenCalled();
  });
});
