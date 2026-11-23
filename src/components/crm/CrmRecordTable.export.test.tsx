import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as CrmServiceModule from '@/services/crmService';
import type * as TenantServicesModule from '@/services/tenantServices';
import type * as CrmCsvModule from '@/lib/crmCsvExport';
import type { StatusInfo, Workflow, WorkflowRecord } from '@/types/tenant';

vi.mock('react-router-dom', async () => ({
  useNavigate: () => vi.fn(),
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
vi.mock('@/lib/crmCsvExport', async (importOriginal) => ({
  ...(await importOriginal<typeof CrmCsvModule>()),
  downloadCsv: vi.fn(),
}));

import { LeadTable } from '@/pages/crm/lead/components/LeadTable';
import { ProspectTable } from '@/pages/crm/prospect/components/ProspectTable';
import { CustomerTable } from '@/pages/crm/customer/components/CustomerTable';
import { crmService } from '@/services/crmService';
import { userService } from '@/services/tenantServices';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { downloadCsv } from '@/lib/crmCsvExport';

// The table reads this many records per request when exporting (EXPORT_PAGE_SIZE).
const EXPORT_PAGE_SIZE = 200;
// Each test renders a table and clicks through it. A busy CI shard has stalled
// such tests past Vitest's default 5s limit, which was also the length of every
// wait below, so the test timed out before a wait could say what it was waiting
// for. Give the file room and keep each wait shorter than the test.
vi.setConfig({ testTimeout: 20_000 });
const SETTLE = { timeout: 10_000 };
const OWNER_ID = 'user-1';
const OWNER_NAME = 'Dana Reyes';

interface PageCase {
  name: string;
  Page: () => React.JSX.Element;
  workflow: string;
  /** Singular label the table uses in its button names and filename. */
  label: string;
  status: StatusInfo;
}

function statusInfo(workflowKey: string, label: string): StatusInfo {
  return {
    stateId: `${workflowKey}-s1`, stateKey: 'S1', statusLabel: label, workflowKey, workflowName: workflowKey,
    isInitial: true, isTerminal: false, sortOrder: 1, color: '',
  };
}

const PAGES: PageCase[] = [
  { name: 'Leads', Page: LeadTable, workflow: 'lead', label: 'Lead', status: statusInfo('lead', 'New') },
  { name: 'Prospects', Page: ProspectTable, workflow: 'prospect', label: 'Prospect', status: statusInfo('prospect', 'In Discussion') },
  { name: 'Customers', Page: CustomerTable, workflow: 'customer', label: 'Customer', status: statusInfo('customer', 'Active') },
];

function makeRecord(c: PageCase, n: number, company: string): WorkflowRecord {
  return {
    id: `rec-${n}`, workflowId: 'wf-1', currentStateId: c.status.stateId,
    coreFields: { customer_name: company, customer_contact_email: `c${n}@example.com` },
    customFields: {}, recordNumber: `REC-000${n}`, ownerUserId: OWNER_ID,
    createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z',
  };
}

type SearchRequest = Parameters<typeof crmService.searchRecords>[1];
type Responder = (req: SearchRequest) => ReturnType<typeof crmService.searchRecords>;

function renderPage(c: PageCase, respond: Responder) {
  vi.mocked(crmService.searchRecords).mockImplementation((_workflow, req) => respond(req));
  vi.mocked(crmService.getWorkflowStatuses).mockResolvedValue({
    workflow: { key: c.workflow } as Workflow, statuses: [c.status],
  });
  vi.mocked(userService.listAssignableUsers).mockResolvedValue([
    { id: OWNER_ID, fullName: OWNER_NAME },
  ] as Awaited<ReturnType<typeof userService.listAssignableUsers>>);
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false, hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(<QueryClientProvider client={client}><c.Page /></QueryClientProvider>);
}

const page = (records: WorkflowRecord[], nextCursor = '') =>
  Promise.resolve({ records, nextCursor, hasMore: nextCursor !== '', scope: 'all' as const });

const exportCalls = () =>
  vi.mocked(crmService.searchRecords).mock.calls.filter(([, req]) => req.limit === EXPORT_PAGE_SIZE);
const lastCsv = () => vi.mocked(downloadCsv).mock.calls.at(-1)?.[1] ?? '';
const csvLines = () => lastCsv().split('\r\n');

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each(PAGES)('$name list CSV export', (c) => {
  const buttonName = (scope: 'all' | 'filtered') => `Download ${scope} ${c.label.toLowerCase()}s as CSV`;

  it('downloads every record with the columns the table shows, owner included', async () => {
    renderPage(c, () => page([makeRecord(c, 1, 'Fontaine Builders'), makeRecord(c, 2, 'Stone & Sons')]));
    await screen.findByText('Fontaine Builders', {}, SETTLE);
    await screen.findAllByText(OWNER_NAME, {}, SETTLE);
    const visible = screen.getAllByRole('columnheader').map((h) => h.textContent?.trim());

    await userEvent.setup().click(screen.getByRole('button', { name: buttonName('all') }));
    await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1), SETTLE);

    const [filename] = vi.mocked(downloadCsv).mock.calls[0];
    expect(filename).toMatch(new RegExp(`^${c.label.toLowerCase()}s-\\d{4}-\\d{2}-\\d{2}\\.csv$`));
    const [header, first, second] = csvLines();
    // Every visible data column is in the CSV, in the same order.
    const shown = visible.filter((h) => h && h !== 'Actions');
    const columns = header.split(',');
    expect(columns.filter((h) => shown.includes(h))).toEqual(shown);
    expect(first).toContain('Fontaine Builders');
    expect(first).toContain(c.status.statusLabel);
    expect(first).toContain(OWNER_NAME);
    expect(first).toContain('c1@example.com');
    expect(second).toContain('Stone & Sons');
    expect(csvLines()).toHaveLength(3);
  });

  it('exports with the same search the list is showing, and says it is filtered', async () => {
    const respond: Responder = (req) =>
      req.filters?.length ? page([makeRecord(c, 1, 'Fontaine Builders')]) : page([makeRecord(c, 1, 'Fontaine Builders'), makeRecord(c, 2, 'Stone & Sons')]);
    renderPage(c, respond);
    await screen.findByText('Stone & Sons', {}, SETTLE);

    await userEvent.setup().type(screen.getByPlaceholderText(`Search ${c.label.toLowerCase()}s…`), 'fontaine');
    expect(await screen.findByRole('button', { name: buttonName('filtered') }, SETTLE)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByText('Stone & Sons')).toBeNull(), SETTLE);

    await userEvent.setup().click(screen.getByRole('button', { name: buttonName('filtered') }));
    await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1), SETTLE);

    expect(exportCalls().at(-1)?.[1].filters).toEqual([{ field: 'core:customer_name', op: 'contains', value: 'fontaine' }]);
    expect(csvLines()).toHaveLength(2);
    expect(lastCsv()).toContain('Fontaine Builders');
    expect(lastCsv()).not.toContain('Stone & Sons');
  });

  it('pages through every record, not just the page on screen', async () => {
    const respond: Responder = (req) => {
      if (req.limit !== EXPORT_PAGE_SIZE) return page([makeRecord(c, 1, 'Fontaine Builders')], 'next');
      return req.cursor === 'cursor-2'
        ? page([makeRecord(c, 3, 'Third Co')])
        : page([makeRecord(c, 1, 'Fontaine Builders'), makeRecord(c, 2, 'Stone & Sons')], 'cursor-2');
    };
    renderPage(c, respond);
    await screen.findByText('Fontaine Builders', {}, SETTLE);

    await userEvent.setup().click(screen.getByRole('button', { name: buttonName('all') }));
    await waitFor(() => expect(downloadCsv).toHaveBeenCalledTimes(1), SETTLE);

    expect(exportCalls().map(([, req]) => req.cursor)).toEqual([undefined, 'cursor-2']);
    expect(csvLines()).toHaveLength(4);
    expect(lastCsv()).toContain('Third Co');
  });

  it('offers no export for an empty list', async () => {
    renderPage(c, () => page([]));
    await screen.findByText(`No ${c.label.toLowerCase()}s added yet.`, {}, SETTLE);
    expect(screen.queryByRole('button', { name: /download .* as csv/i })).toBeNull();
    expect(downloadCsv).not.toHaveBeenCalled();
  });

  it('shows the error and downloads nothing when the export fails', async () => {
    renderPage(c, (req) => (req.limit === EXPORT_PAGE_SIZE ? Promise.reject(new Error('export failed')) : page([makeRecord(c, 1, 'Fontaine Builders')])));
    await screen.findByText('Fontaine Builders', {}, SETTLE);

    await userEvent.setup().click(screen.getByRole('button', { name: buttonName('all') }));
    expect(await screen.findByText('Failed to export CSV: export failed', {}, SETTLE)).toBeInTheDocument();
    expect(downloadCsv).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: buttonName('all') })).toBeEnabled();
  });

  it('is disabled while exporting', async () => {
    renderPage(c, (req) => (req.limit === EXPORT_PAGE_SIZE ? new Promise(() => {}) : page([makeRecord(c, 1, 'Fontaine Builders')])));
    await screen.findByText('Fontaine Builders', {}, SETTLE);

    await userEvent.setup().click(screen.getByRole('button', { name: buttonName('all') }));
    const busy = await screen.findByRole('button', { name: buttonName('all') }, SETTLE);
    expect(within(busy).queryByText('Exporting…') ?? busy).toHaveTextContent('Exporting…');
    expect(busy).toBeDisabled();
  });
});
