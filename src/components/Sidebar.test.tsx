import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/hooks/useWorkflows', () => ({ useWorkflows: vi.fn() }));
vi.mock('@/store/useAuthStore', () => ({ useAuthStore: vi.fn() }));

import Sidebar from './Sidebar';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useAuthStore } from '@/store/useAuthStore';

type Grant = { resource: string; action: string };
type WorkflowState = { key: string; enabled: boolean };

/** Drives the component the way the real hooks would, without a server. */
function setup({
  grants = [],
  isPlatformAdmin = false,
  isLoading = false,
  disabledWorkflows = [],
  workflowsLoading = false,
}: {
  grants?: Grant[];
  isPlatformAdmin?: boolean;
  isLoading?: boolean;
  /** Workflow keys treated as disabled; every other key fails open (enabled). */
  disabledWorkflows?: string[];
  workflowsLoading?: boolean;
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

  const workflows: WorkflowState[] = disabledWorkflows.map((key) => ({ key, enabled: false }));
  vi.mocked(useWorkflows).mockReturnValue({
    workflows: [],
    isLoading: workflowsLoading,
    isWorkflowEnabled: (key: string) => workflows.find((w) => w.key === key)?.enabled ?? true,
  } as ReturnType<typeof useWorkflows>);

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
  });

  // Subscription has no catalog resource, so only the wildcard super_admin
  // grant (the tenant's owner) can ever satisfy its permission check.
  it('hides Subscription from a user with no grants', () => {
    setup({ grants: [] });

    expect(screen.queryByText('Subscription')).toBeNull();
  });

  it('shows Subscription to a user holding the super_admin wildcard grant', () => {
    setup({ grants: [{ resource: '*', action: '*' }] });

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

describe('Sidebar workflow-enabled gating', () => {
  const fullGrants = [{ resource: '*', action: '*' }];

  it('hides a link whose workflow is disabled, even for a full-grant user', () => {
    setup({ grants: fullGrants, disabledWorkflows: ['lead'] });

    expect(screen.queryByText('Leads')).toBeNull();
    expect(screen.getByText('Prospects')).toBeInTheDocument();
    expect(screen.getByText('Customers')).toBeInTheDocument();
  });

  it('collapses the CRM group entirely once every CRM workflow is disabled', () => {
    setup({ grants: fullGrants, disabledWorkflows: ['lead', 'prospect', 'customer'] });

    expect(screen.queryByText('CRM')).toBeNull();
  });

  it('hides a disabled Sales workflow link without affecting its siblings', () => {
    setup({ grants: fullGrants, disabledWorkflows: ['quote'] });

    expect(screen.queryByText('Quotes')).toBeNull();
    expect(screen.getByText('Estimates')).toBeInTheDocument();
    expect(screen.getByText('Sales Orders')).toBeInTheDocument();
  });

  it('hides a disabled Purchases workflow link without affecting its siblings', () => {
    setup({ grants: fullGrants, disabledWorkflows: ['purchase_order'] });

    expect(screen.queryByText('Purchase Orders')).toBeNull();
    expect(screen.getByText('Vendors')).toBeInTheDocument();
    expect(screen.getByText('Expenses')).toBeInTheDocument();
  });

  // Mirrors the permissions-loading behaviour: don't flicker a link away
  // before we actually know its workflow is disabled.
  it('shows links while workflow data is still loading', () => {
    setup({ grants: fullGrants, disabledWorkflows: ['lead'], workflowsLoading: true });

    expect(screen.getByText('Leads')).toBeInTheDocument();
  });
});
