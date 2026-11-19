import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as CrmServiceModule from '@/services/crmService';
import type * as TenantServicesModule from '@/services/tenantServices';
import type { StatusInfo, Workflow, WorkflowRecord } from '@/types/tenant';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async () => ({
  useNavigate: () => navigate,
  Link: (await import('@/test/routerLinkStub')).RouterLinkStub,
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/crmService', async (importOriginal) => {
  const actual = await importOriginal<typeof CrmServiceModule>();
  return { ...actual, crmService: { searchRecords: vi.fn(), getWorkflowStatuses: vi.fn() } };
});
vi.mock('@/services/tenantServices', async (importOriginal) => {
  const actual = await importOriginal<typeof TenantServicesModule>();
  return { ...actual, userService: { listAssignableUsers: vi.fn() } };
});

import LeadPage from './LeadPage';
import { crmService } from '@/services/crmService';
import { userService } from '@/services/tenantServices';
import { useUserPermissions } from '@/hooks/useUserPermissions';

const SETTLE = { timeout: 5_000 };
const SKELETON_ROWS = 5;
const NEW_LEAD_PATH = '/crm/lead/new';

const STATUS: StatusInfo = {
  stateId: 'lead-new', stateKey: 'LNEW', statusLabel: 'New', workflowKey: 'lead', workflowName: 'Lead',
  isInitial: true, isTerminal: false, sortOrder: 1, color: '',
};

function makeLead(n: number, company: string): WorkflowRecord {
  return {
    id: `lead-${n}`, workflowId: 'wf-lead', currentStateId: STATUS.stateId,
    coreFields: { customer_name: company, customer_contact_email: `lead${n}@example.com` },
    customFields: {}, recordNumber: `LD-000${n}`,
    createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z',
  };
}

function grant(canCreate: boolean, isLoading = false) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => canCreate || !(resource === 'lead' && action === 'create'),
  } as ReturnType<typeof useUserPermissions>);
}

function renderPage(search: ReturnType<typeof crmService.searchRecords>) {
  vi.mocked(crmService.searchRecords).mockReturnValue(search);
  vi.mocked(crmService.getWorkflowStatuses).mockResolvedValue({
    workflow: { key: 'lead' } as Workflow, statuses: [STATUS],
  });
  vi.mocked(userService.listAssignableUsers).mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><LeadPage /></QueryClientProvider>);
}

const records = (list: WorkflowRecord[]) =>
  Promise.resolve({ records: list, nextCursor: '', hasMore: false, scope: 'all' as const });

describe('LeadPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grant(true);
  });

  it('lists the leads with their status under the page heading', async () => {
    renderPage(records([makeLead(1, 'Fontaine Builders'), makeLead(2, 'Stone & Sons')]));
    expect(screen.getByRole('heading', { name: 'Leads' })).toBeInTheDocument();
    expect(await screen.findByText('Fontaine Builders', {}, SETTLE)).toBeInTheDocument();
    expect(screen.getByText('Stone & Sons')).toBeInTheDocument();
    expect(await screen.findAllByText('New', {}, SETTLE)).toHaveLength(2);
    expect(screen.getByText('lead1@example.com')).toBeInTheDocument();
  });

  it('shows placeholder rows, not an empty or error message, while loading', () => {
    renderPage(new Promise(() => {}));
    expect(document.querySelectorAll('tbody tr')).toHaveLength(SKELETON_ROWS);
    expect(screen.queryByText('No leads added yet.')).toBeNull();
    expect(screen.queryByText(/failed to load/i)).toBeNull();
  });

  it('invites the first lead when there are none', async () => {
    renderPage(records([]));
    expect(await screen.findByText('No leads added yet.', {}, SETTLE)).toBeInTheDocument();
    expect(screen.getByText('Create your first lead to get started.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download .* as csv/i })).toBeNull();
  });

  it('says so when the leads cannot be loaded', async () => {
    renderPage(Promise.reject(new Error('boom')));
    expect(await screen.findByText('Failed to load leads. Please try again.', {}, SETTLE)).toBeInTheDocument();
  });

  it('opens the new-lead form from New Lead', async () => {
    renderPage(records([]));
    await userEvent.setup().click(screen.getByRole('button', { name: 'New Lead' }));
    expect(navigate).toHaveBeenCalledWith(NEW_LEAD_PATH);
  });

  it('hides New Lead from someone who may not create leads', async () => {
    grant(false);
    renderPage(records([]));
    await screen.findByText('No leads added yet.', {}, SETTLE);
    expect(screen.queryByRole('button', { name: 'New Lead' })).toBeNull();
  });

  it('shows New Lead while permissions are still loading, to avoid a flash', () => {
    grant(false, true);
    renderPage(new Promise(() => {}));
    expect(screen.getByRole('button', { name: 'New Lead' })).toBeInTheDocument();
  });
});
