import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as TenantServicesModule from '@/services/tenantServices';
import type { CatalogResponse, Role } from '@/types/tenant';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/tenantServices', async (importOriginal) => {
  const actual = await importOriginal<typeof TenantServicesModule>();
  return {
    ...actual,
    rbacService: { listRoles: vi.fn(), catalog: vi.fn(), deleteRole: vi.fn() },
    userService: { listUsers: vi.fn() },
  };
});

import RolesPage from './RolesPage';
import { rbacService, userService } from '@/services/tenantServices';
import { useUserPermissions } from '@/hooks/useUserPermissions';

// Each test renders a table and clicks through it. A busy CI shard has stalled
// such tests past Vitest's default 5s limit, which was also the length of every
// wait below, so the test timed out before a wait could say what it was waiting
// for. Give the file room and keep each wait shorter than the test.
vi.setConfig({ testTimeout: 20_000 });
const SETTLE = { timeout: 10_000 };

const ADMIN: Role = {
  id: 'r-admin', key: 'admin', name: 'Administrator', description: 'Full control of the workspace.',
  isSystem: true, permissions: [{ resource: '*', action: '*', scope: 'all' }],
};
const SALES: Role = {
  id: 'r-sales', key: 'sales', name: 'Sales Rep', description: 'Works the lead pipeline.',
  isSystem: false,
  permissions: [
    { resource: 'lead', action: 'read', scope: 'own' },
    { resource: 'lead', action: 'create', scope: 'own' },
  ],
};
const OBSERVER: Role = {
  id: 'r-observer', key: 'observer', name: 'Observer', description: '', isSystem: false, permissions: [],
};
const CATALOG: CatalogResponse = {
  success: true,
  permissions: [
    { resource: 'lead', action: 'read' },
    { resource: 'lead', action: 'create' },
    { resource: 'lead', action: 'update' },
  ],
  scopes: ['all', 'own'],
};

/** Grants exactly the `resource:action` keys given; everything else is denied. */
function allow(...keys: string[]) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => keys.includes(`${resource}:${action}`),
  } as ReturnType<typeof useUserPermissions>);
}

function renderPage(roles: Promise<Role[]> | Role[] = [ADMIN, SALES, OBSERVER]) {
  vi.mocked(rbacService.listRoles).mockReturnValue(Promise.resolve(roles) as ReturnType<typeof rbacService.listRoles>);
  vi.mocked(rbacService.catalog).mockResolvedValue(CATALOG);
  vi.mocked(userService.listUsers).mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><RolesPage /></QueryClientProvider>);
}

const roleButton = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) });

describe('RolesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    allow('role:create', 'role:update', 'role:delete');
  });

  it('lists every role with a summary of what it grants', async () => {
    renderPage();
    expect(screen.getByRole('heading', { name: /roles & access/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /^Administrator/ }, SETTLE)).toHaveTextContent('All permissions');
    expect(roleButton('Sales Rep')).toHaveTextContent('2 permissions');
    expect(roleButton('Observer')).toHaveTextContent('No permissions');
  });

  it('says it is loading, and shows no roles yet', () => {
    renderPage(new Promise<Role[]>(() => {}));
    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Administrator/ })).toBeNull();
  });

  it('shows the error when the roles cannot be loaded', async () => {
    vi.mocked(rbacService.listRoles).mockRejectedValue(new Error('Roles are unavailable.'));
    vi.mocked(rbacService.catalog).mockResolvedValue(CATALOG);
    vi.mocked(userService.listUsers).mockResolvedValue([]);
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(<QueryClientProvider client={client}><RolesPage /></QueryClientProvider>);
    expect(await screen.findByText('Roles are unavailable.', {}, SETTLE)).toBeInTheDocument();
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('asks the user to pick a role when there are none to show', async () => {
    renderPage([]);
    expect(await screen.findByText('Select a role to view its permissions.', {}, SETTLE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Administrator/ })).toBeNull();
  });

  it('opens the first role by default; a wildcard role shows full access', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Administrator' }, SETTLE)).toBeInTheDocument();
    expect(screen.getByText('Full Access')).toBeInTheDocument();
    expect(screen.getByText('All permissions granted')).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('opens a role and shows the permissions it grants, with their scope', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Administrator' }, SETTLE);

    await userEvent.setup().click(roleButton('Sales Rep'));

    expect(await screen.findByRole('heading', { name: 'Sales Rep' }, SETTLE)).toBeInTheDocument();
    expect(screen.getByText('2 permissions granted')).toBeInTheDocument();
    const table = screen.getByRole('table');
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent?.trim());
    // Only the actions the catalog offers on this module, then the scope.
    expect(headers).toEqual(['Resource', 'Read', 'Create', 'Edit', 'Scope']);
    const row = within(table).getByText('lead').closest('tr');
    expect(row).not.toBeNull();
    expect(row).toHaveTextContent('Own');
    expect(screen.queryByText('Full Access')).toBeNull();
  });

  it('says so when a role grants nothing', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Administrator' }, SETTLE);
    await userEvent.setup().click(roleButton('Observer'));
    expect(await screen.findByText('No permissions assigned to this role.', {}, SETTLE)).toBeInTheDocument();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('opens the new-role form from New Role', async () => {
    renderPage();
    await userEvent.setup().click(screen.getByRole('button', { name: 'New Role' }));
    expect(navigate).toHaveBeenCalledWith('/config/roles/new');
  });

  it('opens a custom role for editing', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Administrator' }, SETTLE);
    const user = userEvent.setup();
    await user.click(roleButton('Sales Rep'));
    await user.click(await screen.findByRole('button', { name: 'Edit role Sales Rep' }, SETTLE));
    expect(navigate).toHaveBeenCalledWith('/config/roles/r-sales/edit');
  });

  it('offers no Edit or Delete on a system role', async () => {
    renderPage();
    await screen.findByRole('heading', { name: 'Administrator' }, SETTLE);
    expect(screen.queryByRole('button', { name: 'Edit role Administrator' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete role Administrator' })).toBeNull();
  });

  it('shows read-only access to someone who may not change roles', async () => {
    allow();
    renderPage();
    await screen.findByRole('heading', { name: 'Administrator' }, SETTLE);
    await userEvent.setup().click(roleButton('Sales Rep'));
    await screen.findByRole('heading', { name: 'Sales Rep' }, SETTLE);
    expect(screen.queryByRole('button', { name: 'New Role' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit role Sales Rep' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete role Sales Rep' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add user to role Sales Rep' })).toBeNull();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });
});
