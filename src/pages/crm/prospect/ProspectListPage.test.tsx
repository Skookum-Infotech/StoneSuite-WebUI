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
  useSearchParams: (await import('@/test/routerSearchParamsStub')).useSearchParams,
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

import ProspectListPage from './ProspectListPage';
import { crmService } from '@/services/crmService';
import { userService } from '@/services/tenantServices';
import { useUserPermissions } from '@/hooks/useUserPermissions';

// Each test renders a table and clicks through it. A busy CI shard has stalled
// such tests past Vitest's default 5s limit, which was also the length of every
// wait below, so the test timed out before a wait could say what it was waiting
// for. Give the file room and keep each wait shorter than the test.
vi.setConfig({ testTimeout: 20_000 });
const SETTLE = { timeout: 10_000 };
const SKELETON_ROWS = 5;
const NEW_PROSPECT_PATH = '/crm/prospect/new';

const STATUS: StatusInfo = {
  stateId: 'prospect-disc', stateKey: 'PDIS', statusLabel: 'In Discussion', workflowKey: 'prospect', workflowName: 'Prospect',
  isInitial: true, isTerminal: false, sortOrder: 1, color: '',
};

function makeProspect(n: number, company: string): WorkflowRecord {
  return {
    id: `prospect-${n}`, workflowId: 'wf-prospect', currentStateId: STATUS.stateId,
    coreFields: { customer_name: company, customer_contact_email: `prospect${n}@example.com` },
    customFields: {}, recordNumber: `PR-000${n}`,
    createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z',
  };
}

function grant(canCreate: boolean, isLoading = false) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => canCreate || !(resource === 'prospect' && action === 'create'),
  } as ReturnType<typeof useUserPermissions>);
}

function renderPage(search: ReturnType<typeof crmService.searchRecords>) {
  vi.mocked(crmService.searchRecords).mockReturnValue(search);
  vi.mocked(crmService.getWorkflowStatuses).mockResolvedValue({
    workflow: { key: 'prospect' } as Workflow, statuses: [STATUS],
  });
  vi.mocked(userService.listAssignableUsers).mockResolvedValue([]);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><ProspectListPage /></QueryClientProvider>);
}

const records = (list: WorkflowRecord[]) =>
  Promise.resolve({ records: list, nextCursor: '', hasMore: false, scope: 'all' as const });

describe('ProspectListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    grant(true);
  });

  it('lists the prospects with their status under the page heading', async () => {
    renderPage(records([makeProspect(1, 'Fontaine Builders'), makeProspect(2, 'Stone & Sons')]));
    expect(screen.getByRole('heading', { name: 'Prospects' })).toBeInTheDocument();
    expect(await screen.findByText('Fontaine Builders', {}, SETTLE)).toBeInTheDocument();
    expect(screen.getByText('Stone & Sons')).toBeInTheDocument();
    expect(await screen.findAllByText('In Discussion', {}, SETTLE)).toHaveLength(2);
    expect(screen.getByText('prospect1@example.com')).toBeInTheDocument();
  });

  it('shows placeholder rows, not an empty or error message, while loading', () => {
    renderPage(new Promise(() => {}));
    expect(document.querySelectorAll('tbody tr')).toHaveLength(SKELETON_ROWS);
    expect(screen.queryByText('No prospects added yet.')).toBeNull();
    expect(screen.queryByText(/failed to load/i)).toBeNull();
  });

  it('invites the first prospect when there are none', async () => {
    renderPage(records([]));
    expect(await screen.findByText('No prospects added yet.', {}, SETTLE)).toBeInTheDocument();
    expect(screen.getByText('Create your first prospect to get started.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /download .* as csv/i })).toBeNull();
  });

  it('says so when the prospects cannot be loaded', async () => {
    renderPage(Promise.reject(new Error('boom')));
    expect(await screen.findByText('Failed to load prospects. Please try again.', {}, SETTLE)).toBeInTheDocument();
  });

  it('opens the new-prospect form from New Prospect', async () => {
    renderPage(records([]));
    await userEvent.setup().click(screen.getByRole('button', { name: 'New Prospect' }));
    expect(navigate).toHaveBeenCalledWith(NEW_PROSPECT_PATH);
  });

  it('hides New Prospect from someone who may not create prospects', async () => {
    grant(false);
    renderPage(records([]));
    await screen.findByText('No prospects added yet.', {}, SETTLE);
    expect(screen.queryByRole('button', { name: 'New Prospect' })).toBeNull();
  });

  it('shows New Prospect while permissions are still loading, to avoid a flash', () => {
    grant(false, true);
    renderPage(new Promise(() => {}));
    expect(screen.getByRole('button', { name: 'New Prospect' })).toBeInTheDocument();
  });
});
