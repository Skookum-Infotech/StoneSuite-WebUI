import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as CrmServiceModule from '@/services/crmService';
import type * as TenantServicesModule from '@/services/tenantServices';
import type { StatusInfo, Workflow, WorkflowRecord } from '@/types/tenant';

vi.mock('react-router-dom', async () => ({
  useNavigate: () => vi.fn(),
  Link: (await import('@/test/routerLinkStub')).RouterLinkStub,
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/crmService', async (importOriginal) => {
  const actual = await importOriginal<typeof CrmServiceModule>();
  return {
    ...actual,
    crmService: {
      searchRecords: vi.fn(),
      getWorkflowStatuses: vi.fn(),
      getAvailableTransitions: vi.fn(),
      transitionRecord: vi.fn(),
    },
  };
});
vi.mock('@/services/tenantServices', async (importOriginal) => {
  const actual = await importOriginal<typeof TenantServicesModule>();
  return { ...actual, userService: { listAssignableUsers: vi.fn() } };
});

import { CrmRecordTable, type CrmTableConfig } from './CrmRecordTable';
import { crmService } from '@/services/crmService';
import { userService } from '@/services/tenantServices';
import { useUserPermissions } from '@/hooks/useUserPermissions';

// This suite shares the machine with ~170 others in parallel jsdom workers, and
// a starved worker can take well over the 1s default to settle a mocked query.
// Waits use cheap text queries (findByText); the expensive accessible-name
// queries (getByRole) only run synchronously, once the DOM has settled.
const SETTLE_TIMEOUT_MS = 5_000;
const SETTLE = { timeout: SETTLE_TIMEOUT_MS };

const COMPANY = 'Fontaine Builders';

function status(workflowKey: string, stateId: string, stateKey: string, statusLabel: string): StatusInfo {
  return {
    stateId, stateKey, statusLabel, workflowKey, workflowName: workflowKey,
    isInitial: false, isTerminal: false, sortOrder: Number(stateId), color: '',
  };
}

function config(workflowKey: string, label: string): CrmTableConfig {
  return {
    workflowKey,
    label,
    detailPath: (id) => `/crm/${workflowKey}/${id}`,
    editPath: (id) => `/crm/${workflowKey}/${id}/edit`,
    queryKey: ['crm-records', workflowKey] as const,
    showEmail: workflowKey === 'lead',
  };
}

interface WorkflowCase {
  workflow: string;
  config: CrmTableConfig;
  /** The one record's own status. */
  current: StatusInfo;
  /** A legal next status for it. */
  move: StatusInfo;
}

const LEAD: WorkflowCase = {
  workflow: 'lead',
  config: config('lead', 'Lead'),
  current: status('lead', '12', 'LNEW', 'New'),
  move: status('lead', '1', 'LQUA', 'Lead Qualified'),
};
const PROSPECT: WorkflowCase = {
  workflow: 'prospect',
  config: config('prospect', 'Prospect'),
  current: status('prospect', '20', 'PDIS', 'In Discussion'),
  move: status('prospect', '21', 'PNEG', 'In Negotiation'),
};
const CUSTOMER: WorkflowCase = {
  workflow: 'customer',
  config: config('customer', 'Customer'),
  current: status('customer', '30', 'CACT', 'Active'),
  move: status('customer', '31', 'CCHD', 'Credit Hold'),
};

function mockPermissions(isSuperAdmin: boolean) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    isSuperAdmin,
    hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
}

function makeRecord(currentStateId: string): WorkflowRecord {
  return {
    id: 'rec-1',
    workflowId: 'wf-1',
    currentStateId,
    coreFields: { customer_name: COMPANY, customer_contact_email: 'info@fontaine.example' },
    customFields: {},
    recordNumber: 'REC-0001',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
  };
}

/** Renders the table with one record in `c.current`, and returns that record's row. */
async function renderRow(c: WorkflowCase): Promise<HTMLElement> {
  vi.mocked(crmService.searchRecords).mockResolvedValue({
    records: [makeRecord(c.current.stateId)], nextCursor: '', hasMore: false, scope: 'all',
  });
  vi.mocked(crmService.getWorkflowStatuses).mockResolvedValue({
    workflow: { key: c.workflow } as Workflow,
    statuses: [c.current, c.move],
  });
  vi.mocked(crmService.getAvailableTransitions).mockResolvedValue([c.move]);
  vi.mocked(userService.listAssignableUsers).mockResolvedValue([]);

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <CrmRecordTable config={c.config} />
    </QueryClientProvider>,
  );

  const tableRow = (await screen.findByText(COMPANY, {}, SETTLE)).closest('tr');
  expect(tableRow).not.toBeNull();
  const row = tableRow as HTMLElement;
  // The status cell reads '—' until the workflow's status catalog has loaded.
  await within(row).findByText(c.current.statusLabel, {}, SETTLE);
  return row;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// Only a super admin may change a Lead's or Prospect's status from its list;
// everyone else sees the status but gets no control for it (they move the
// record from its Detail or Edit page).
describe.each([LEAD, PROSPECT])('$workflow list status cell', (c) => {
  it('gives a non-admin the status as plain text, with no dropdown to change it', async () => {
    mockPermissions(false);
    const row = await renderRow(c);

    expect(within(row).queryByRole('button', { name: c.current.statusLabel })).not.toBeInTheDocument();
  });

  it('gives a super admin the status dropdown, offering the record\'s next moves', async () => {
    const user = userEvent.setup();
    mockPermissions(true);
    const row = await renderRow(c);

    await user.click(within(row).getByRole('button', { name: c.current.statusLabel }));
    const listbox = await screen.findByRole('listbox', {}, SETTLE);
    await within(listbox).findByText(c.move.statusLabel, {}, SETTLE);

    expect(within(listbox).getByRole('option', { name: c.move.statusLabel })).toBeInTheDocument();
  });
});

// A customer's status is changed with the Quick Action buttons on its detail
// page, never from a dropdown -- so its list row is plain text for everyone,
// super admin included.
describe('customer list status cell', () => {
  it.each([
    { role: 'a non-admin', isSuperAdmin: false },
    { role: 'a super admin', isSuperAdmin: true },
  ])('shows $role the status as plain text, never a dropdown', async ({ isSuperAdmin }) => {
    mockPermissions(isSuperAdmin);
    const row = await renderRow(CUSTOMER);

    expect(within(row).queryByRole('button', { name: CUSTOMER.current.statusLabel })).not.toBeInTheDocument();
  });
});
