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

import { CustomerTable } from '@/pages/crm/customer/components/CustomerTable';
import { LeadTable } from '@/pages/crm/lead/components/LeadTable';
import { crmService } from '@/services/crmService';
import { userService } from '@/services/tenantServices';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { downloadCsv } from '@/lib/crmCsvExport';

// These tests render a whole table and click through it. They take well under a
// second locally, but a busy CI shard once stalled one past Vitest's default 5s
// test limit, which was also the length of every wait below, so the test timed
// out before a wait could report what it was waiting for. Give the file room and
// keep each wait shorter than the test, so a real failure still names its cause.
vi.setConfig({ testTimeout: 20_000 });
const SETTLE = { timeout: 10_000 };
// The table's search box debounces by 300ms and, once after it first appears,
// resets paging to page 1 even though nothing was typed. Let that pass before
// paging, or on a slow shard the reset lands after the click and undoes it.
const DEBOUNCE_SETTLE_MS = 400;
const afterSearchDebounce = () => new Promise<void>((resolve) => setTimeout(resolve, DEBOUNCE_SETTLE_MS));
const STATUS: StatusInfo = {
  stateId: 'cust-active', stateKey: 'CACT', statusLabel: 'Active', workflowKey: 'customer', workflowName: 'Customer',
  isInitial: true, isTerminal: false, sortOrder: 1, color: '',
};

function makeCustomer(n: number, company: string): WorkflowRecord {
  return {
    id: `cust-${n}`, workflowId: 'wf-1', currentStateId: STATUS.stateId,
    coreFields: { customer_name: company, customer_contact_email: `c${n}@example.com` },
    customFields: {}, recordNumber: `CU-000${n}`, ownerUserId: 'user-1',
    createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-02T00:00:00Z',
  };
}

const A = makeCustomer(1, 'Alpha Builders');
const B = makeCustomer(2, 'Bravo Stone');
const C = makeCustomer(3, 'Charlie Homes');
const D = makeCustomer(4, 'Delta Kitchens');

type Request = Parameters<typeof crmService.searchRecords>[1];

/** Page 1 is A, B, C (or C, B, A when sorted by modified date); page 2 is D. */
function respond(req: Request) {
  if (req.cursor === 'page-2') return { records: [D], nextCursor: '', hasMore: false, scope: 'all' as const };
  const byModified = req.sort?.[0]?.field === 'updated_at';
  return { records: byModified ? [C, B, A] : [A, B, C], nextCursor: 'page-2', hasMore: true, scope: 'all' as const };
}

function renderTable(Table: () => React.JSX.Element) {
  vi.mocked(crmService.searchRecords).mockImplementation(async (_workflow, req) => respond(req));
  vi.mocked(crmService.getWorkflowStatuses).mockResolvedValue({
    workflow: { key: 'customer' } as Workflow, statuses: [STATUS],
  });
  vi.mocked(userService.listAssignableUsers).mockResolvedValue([
    { id: 'user-1', fullName: 'Dana Reyes' },
  ] as Awaited<ReturnType<typeof userService.listAssignableUsers>>);
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false, hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><Table /></QueryClientProvider>);
}

const rowBox = (company: string) => screen.getByRole('checkbox', { name: `Select ${company}` });
const selectAll = () => screen.getByRole('checkbox', { name: 'Select all on this page' });
const bar = () => screen.queryByRole('region', { name: 'Selected rows' });
const csv = () => String(vi.mocked(downloadCsv).mock.calls.at(-1)?.[1] ?? '');

describe('Customers list selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no layout; the table scrolls to its top when the page changes.
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('gives every customer a labelled checkbox, none ticked, and no bar', async () => {
    renderTable(CustomerTable);
    await screen.findByText('Alpha Builders', {}, SETTLE);
    for (const c of ['Alpha Builders', 'Bravo Stone', 'Charlie Homes']) expect(rowBox(c)).toHaveAttribute('aria-checked', 'false');
    expect(selectAll()).toHaveAttribute('aria-checked', 'false');
    expect(bar()).toBeNull();
  });

  it('counts ticked rows in the bar, and Clear lets go of them', async () => {
    renderTable(CustomerTable);
    await screen.findByText('Alpha Builders', {}, SETTLE);
    const user = userEvent.setup();
    await user.click(rowBox('Alpha Builders'));
    await user.click(rowBox('Charlie Homes'));
    expect(within(bar() as HTMLElement).getByRole('status')).toHaveTextContent('2 selected');
    expect(selectAll()).toHaveAttribute('aria-checked', 'mixed');

    await user.click(within(bar() as HTMLElement).getByRole('button', { name: 'Clear' }));
    expect(bar()).toBeNull();
    expect(rowBox('Alpha Builders')).toHaveAttribute('aria-checked', 'false');
  });

  it('select-all ticks only this page; the next page starts empty', async () => {
    renderTable(CustomerTable);
    await screen.findByText('Alpha Builders', {}, SETTLE);
    await afterSearchDebounce();
    const user = userEvent.setup();
    await user.click(selectAll());
    expect(within(bar() as HTMLElement).getByRole('status')).toHaveTextContent('3 selected');

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('Delta Kitchens', {}, SETTLE);
    expect(rowBox('Delta Kitchens')).toHaveAttribute('aria-checked', 'false');
    expect(bar()).toBeNull();
  });

  it('exports only the selected customers, with the same columns as the full export', async () => {
    renderTable(CustomerTable);
    await screen.findByText('Alpha Builders', {}, SETTLE);
    const user = userEvent.setup();
    await user.click(rowBox('Bravo Stone'));
    await user.click(screen.getByRole('button', { name: 'Export selected (CSV)' }));

    expect(downloadCsv).toHaveBeenCalledTimes(1);
    expect(vi.mocked(downloadCsv).mock.calls[0][0]).toMatch(/^customers-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = csv().split('\r\n');
    // Same builder as the full export, so the same columns (whatever else it adds).
    expect(lines[0]).toMatch(/^Record Number,Company,Status,.*Email,Created,Updated$/);
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('Bravo Stone');
    expect(lines[1]).toContain('c2@example.com');
    expect(csv()).not.toContain('Alpha Builders');
    expect(csv()).not.toContain('Charlie Homes');
    // Nothing is fetched for it: the full-list export is a different button.
    expect(vi.mocked(crmService.searchRecords).mock.calls.every(([, req]) => req.limit !== 200)).toBe(true);
  });

  it('keeps the selection when the list is re-sorted', async () => {
    renderTable(CustomerTable);
    await screen.findByText('Alpha Builders', {}, SETTLE);
    const user = userEvent.setup();
    await user.click(rowBox('Bravo Stone'));

    await user.click(screen.getByRole('button', { name: /^Date Modified/ }));
    await waitFor(() => {
      const order = screen.getAllByRole('checkbox', { name: /^Select [A-Z]/ }).map((b) => b.getAttribute('aria-label'));
      expect(order).toEqual(['Select Charlie Homes', 'Select Bravo Stone', 'Select Alpha Builders']);
    }, SETTLE);
    expect(rowBox('Bravo Stone')).toHaveAttribute('aria-checked', 'true');
    expect(within(bar() as HTMLElement).getByRole('status')).toHaveTextContent('1 selected');
  });

  it('clears the selection when the search changes', async () => {
    renderTable(CustomerTable);
    await screen.findByText('Alpha Builders', {}, SETTLE);
    const user = userEvent.setup();
    await user.click(rowBox('Alpha Builders'));
    expect(bar()).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search customers…'), 'a');
    expect(bar()).toBeNull();
  });

  it('can be operated from the keyboard', async () => {
    renderTable(CustomerTable);
    await screen.findByText('Alpha Builders', {}, SETTLE);
    const user = userEvent.setup();
    rowBox('Bravo Stone').focus();
    await user.keyboard(' ');
    expect(rowBox('Bravo Stone')).toHaveAttribute('aria-checked', 'true');
    selectAll().focus();
    await user.keyboard(' ');
    expect(selectAll()).toHaveAttribute('aria-checked', 'true');
  });
});

describe('Leads list', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has no selection column: only Customers and Invoices opted in', async () => {
    renderTable(LeadTable);
    await screen.findByText('Alpha Builders', {}, SETTLE);
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
    expect(bar()).toBeNull();
  });
});
