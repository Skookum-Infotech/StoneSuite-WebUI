import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/hooks/useWorkflows', () => ({ useWorkflows: vi.fn() }));
vi.mock('@/store/useAuthStore', () => ({ useAuthStore: vi.fn() }));

import { PermissionGuard } from './PermissionGuard';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useWorkflows } from '@/hooks/useWorkflows';
import { useAuthStore } from '@/store/useAuthStore';

type Grant = { resource: string; action: string };

function mockHooks({
  grants = [{ resource: '*', action: '*' }],
  isPlatformAdmin = false,
  permissionsLoading = false,
  disabledWorkflows = [],
  workflowsLoading = false,
  kind,
}: {
  grants?: Grant[];
  isPlatformAdmin?: boolean;
  permissionsLoading?: boolean;
  disabledWorkflows?: string[];
  workflowsLoading?: boolean;
  kind?: 'portal';
} = {}) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants,
    isLoading: permissionsLoading,
    activeRoleId: '',
    hasPermission: (resource: string, action: string) =>
      grants.some(
        (g) => (g.resource === resource || g.resource === '*') && (g.action === action || g.action === '*'),
      ),
  } as ReturnType<typeof useUserPermissions>);

  vi.mocked(useWorkflows).mockReturnValue({
    workflows: [],
    isLoading: workflowsLoading,
    isWorkflowEnabled: (key: string) => !disabledWorkflows.includes(key),
  } as ReturnType<typeof useWorkflows>);

  vi.mocked(useAuthStore).mockImplementation((selector) =>
    (selector as (s: unknown) => unknown)({ user: { id: 'u1', isPlatformAdmin }, kind }),
  );
}

beforeEach(() => vi.clearAllMocks());

describe('PermissionGuard', () => {
  it('renders children when no access rule is declared', () => {
    mockHooks();
    render(<PermissionGuard>content</PermissionGuard>);

    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('shows Access Denied when the permission grant is missing', () => {
    mockHooks({ grants: [] });
    render(
      <PermissionGuard resource="lead" action="read">
        content
      </PermissionGuard>,
    );

    expect(screen.queryByText('content')).toBeNull();
    expect(screen.getByText('Access Denied')).toBeInTheDocument();
  });

  it('renders children when the permission grant matches', () => {
    mockHooks({ grants: [{ resource: 'lead', action: 'read' }] });
    render(
      <PermissionGuard resource="lead" action="read">
        content
      </PermissionGuard>,
    );

    expect(screen.getByText('content')).toBeInTheDocument();
  });

  // The core of this feature: a disabled workflow blocks the route for every
  // user, even one holding a full wildcard grant.
  it('shows Form Disabled when the workflow is disabled, regardless of permissions', () => {
    mockHooks({ grants: [{ resource: '*', action: '*' }], disabledWorkflows: ['lead'] });
    render(
      <PermissionGuard resource="lead" action="read" workflowKey="lead">
        content
      </PermissionGuard>,
    );

    expect(screen.queryByText('content')).toBeNull();
    expect(screen.getByText('Form Disabled')).toBeInTheDocument();
    expect(screen.queryByText('Access Denied')).toBeNull();
  });

  it('renders children when the backing workflow is enabled', () => {
    mockHooks({ grants: [{ resource: 'lead', action: 'read' }], disabledWorkflows: [] });
    render(
      <PermissionGuard resource="lead" action="read" workflowKey="lead">
        content
      </PermissionGuard>,
    );

    expect(screen.getByText('content')).toBeInTheDocument();
  });

  it('shows a spinner while permissions are loading', () => {
    mockHooks({ permissionsLoading: true });
    render(
      <PermissionGuard resource="lead" action="read">
        content
      </PermissionGuard>,
    );

    expect(screen.queryByText('content')).toBeNull();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('shows a spinner while workflow data is loading for a workflow-gated route', () => {
    mockHooks({ workflowsLoading: true });
    render(
      <PermissionGuard resource="lead" action="read" workflowKey="lead">
        content
      </PermissionGuard>,
    );

    expect(screen.queryByText('content')).toBeNull();
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('does not wait on workflow data for a route with no workflowKey', () => {
    mockHooks({ workflowsLoading: true });
    render(
      <PermissionGuard resource="lead" action="read">
        content
      </PermissionGuard>,
    );

    expect(screen.getByText('content')).toBeInTheDocument();
  });

  // Regression guard for the portal fail-open bug: PermissionGuard has no
  // portal escape hatch of its own — it renders Form Disabled purely from
  // isWorkflowEnabled's answer, whatever session kind supplied it. The real
  // fix has to live in useWorkflows, not here.
  it('shows Form Disabled for a portal session when the workflow is disabled', () => {
    mockHooks({
      kind: 'portal',
      grants: [{ resource: 'invoice', action: 'read' }],
      disabledWorkflows: ['invoice'],
    });
    render(
      <PermissionGuard resource="invoice" action="read" workflowKey="invoice">
        content
      </PermissionGuard>,
    );

    expect(screen.queryByText('content')).toBeNull();
    expect(screen.getByText('Form Disabled')).toBeInTheDocument();
  });
});
