import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/store/useAuthStore', () => ({ useAuthStore: vi.fn() }));

import Sidebar from './Sidebar';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useAuthStore } from '@/store/useAuthStore';

type Grant = { resource: string; action: string };

/** Drives the component the way the real hooks would, without a server. */
function setup({ grants = [], isPlatformAdmin = false, isLoading = false }: {
  grants?: Grant[];
  isPlatformAdmin?: boolean;
  isLoading?: boolean;
} = {}) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants,
    isLoading,
    activeRoleId: '',
    hasPermission: (resource: string, action: string) =>
      grants.some(
        (g) => (g.resource === resource || g.resource === '*') && (g.action === action || g.action === '*'),
      ),
  } as ReturnType<typeof useUserPermissions>);

  vi.mocked(useAuthStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)({ user: { id: 'u1', isPlatformAdmin } }),
  );

  render(
    <MemoryRouter>
      <Sidebar isOpen onClose={() => {}} />
    </MemoryRouter>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('Sidebar permission gating', () => {
  // Groups render only when at least one child passes its own check, so a
  // group's absence proves every module link under it was gated out.
  it('hides every module group from a user with no grants', () => {
    setup({ grants: [] });

    for (const group of ['CRM', 'Sales', 'Purchases', 'Inventory', 'Finance', 'Configuration']) {
      expect(screen.queryByText(group), `${group} should be hidden`).toBeNull();
    }
  });

  it('still shows links explicitly marked alwaysVisible', () => {
    setup({ grants: [] });

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Subscription')).toBeInTheDocument();
  });

  // Regression guard. platformAdminOnly is an access declaration on its own;
  // an earlier version of the fail-closed default ignored it and hid the
  // Platform section from the only people who can use it.
  it('shows platformAdminOnly links to a platform admin holding no grants', () => {
    setup({ grants: [], isPlatformAdmin: true });

    expect(screen.getByText('Onboarding')).toBeInTheDocument();
  });

  it('hides platformAdminOnly links from a non-platform-admin', () => {
    setup({ grants: [{ resource: '*', action: '*' }], isPlatformAdmin: false });

    expect(screen.queryByText('Onboarding')).toBeNull();
  });

  it('reveals only the groups a grant actually covers', () => {
    setup({ grants: [{ resource: 'quote', action: 'read' }] });

    expect(screen.getByText('Sales')).toBeInTheDocument();
    expect(screen.queryByText('Purchases')).toBeNull();
    expect(screen.queryByText('CRM')).toBeNull();
  });

  it('honours the super_admin wildcard grant', () => {
    setup({ grants: [{ resource: '*', action: '*' }] });

    for (const group of ['CRM', 'Sales', 'Purchases', 'Configuration']) {
      expect(screen.getByText(group), `${group} should be visible`).toBeInTheDocument();
    }
  });
});
