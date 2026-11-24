import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type * as CsvExportModule from '@/lib/csvExport';

vi.mock('react-router-dom', async () => ({
  useNavigate: () => vi.fn(),
  Link: (await import('@/test/routerLinkStub')).RouterLinkStub,
  useSearchParams: (await import('@/test/routerSearchParamsStub')).useSearchParams,
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/invoiceService', () => ({
  invoiceService: { searchInvoices: vi.fn(), transition: vi.fn() },
}));
vi.mock('@/lib/csvExport', async (importOriginal) => ({
  ...(await importOriginal<typeof CsvExportModule>()),
  downloadCsv: vi.fn(),
}));

import { InvoiceTable } from './InvoiceTable';
import { invoiceService } from '@/services/invoiceService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { downloadCsv } from '@/lib/csvExport';
import type { InvoiceSummary } from '@/types/invoice';

// Each test renders a table and clicks through it. A busy CI shard has stalled
// such tests past Vitest's default 5s limit, which was also the length of every
// wait below, so the test timed out before a wait could say what it was waiting
// for. Give the file room and keep each wait shorter than the test.
vi.setConfig({ testTimeout: 20_000 });
const SETTLE = { timeout: 10_000 };
// The table's search box debounces by 300ms and, once after it first appears,
// resets paging to page 1 even though nothing was typed. Let that pass before
// paging, or on a slow shard the reset lands after the click and undoes it.
const DEBOUNCE_SETTLE_MS = 400;
const afterSearchDebounce = () => new Promise<void>((resolve) => setTimeout(resolve, DEBOUNCE_SETTLE_MS));

function makeInvoice(n: number, customer: string, balance: number): InvoiceSummary {
  return {
    id: `inv-${n}`, invoiceNumber: `INV-100${n}`, status: 'Draft', statusCode: 'DRFT', approvalStatus: 'none',
    customer: { id: `c-${n}`, name: customer }, invoiceDate: '2026-09-01', grandTotal: balance + 100, balanceDue: balance,
  };
}

const A = makeInvoice(1, 'Alpha Builders', 300);
const B = makeInvoice(2, 'Bravo Stone', 100);
const C = makeInvoice(3, 'Charlie Homes', 200);
const D = makeInvoice(4, 'Delta Kitchens', 50);

type Request = Parameters<typeof invoiceService.searchInvoices>[0];

/** Page 1 is A, B, C (or C, A, B sorted by balance); page 2 is D. */
function respond(req: Request) {
  if (req.cursor === 'page-2') return { records: [D], nextCursor: '', hasMore: false, scope: 'all' as const };
  const byBalance = req.sort?.[0]?.field === 'balance_due';
  return { records: byBalance ? [A, C, B] : [A, B, C], nextCursor: 'page-2', hasMore: true, scope: 'all' as const };
}

function renderTable(handler: (req: Request) => ReturnType<typeof respond> = respond) {
  vi.mocked(invoiceService.searchInvoices).mockImplementation(async (req) => handler(req));
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false, hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><InvoiceTable /></QueryClientProvider>);
}

const rowBox = (number: string) => screen.getByRole('checkbox', { name: `Select invoice ${number}` });
const selectAll = () => screen.getByRole('checkbox', { name: 'Select all on this page' });
const selectedText = () => screen.queryByRole('status', { name: '' });
const csvText = () => String(vi.mocked(downloadCsv).mock.calls.at(-1)?.[1] ?? '');

describe('InvoiceTable selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // jsdom has no layout; the table scrolls to its top when the page changes.
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('gives every row a labelled checkbox, none ticked, and no bar', async () => {
    renderTable();
    await screen.findByText('INV-1001', {}, SETTLE);
    for (const n of ['INV-1001', 'INV-1002', 'INV-1003']) expect(rowBox(n)).toHaveAttribute('aria-checked', 'false');
    expect(selectAll()).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('region', { name: 'Selected rows' })).toBeNull();
  });

  it('shows the bar with a count once a row is ticked, and Clear lets go', async () => {
    renderTable();
    await screen.findByText('INV-1001', {}, SETTLE);
    const user = userEvent.setup();
    await user.click(rowBox('INV-1001'));
    await user.click(rowBox('INV-1003'));

    const bar = screen.getByRole('region', { name: 'Selected rows' });
    expect(within(bar).getByRole('status')).toHaveTextContent('2 selected');
    expect(selectAll()).toHaveAttribute('aria-checked', 'mixed');

    await user.click(within(bar).getByRole('button', { name: 'Clear' }));
    expect(screen.queryByRole('region', { name: 'Selected rows' })).toBeNull();
    expect(rowBox('INV-1001')).toHaveAttribute('aria-checked', 'false');
  });

  it('select-all ticks only the rows on this page, and again unticks them', async () => {
    renderTable();
    await screen.findByText('INV-1001', {}, SETTLE);
    await afterSearchDebounce();
    const user = userEvent.setup();
    await user.click(selectAll());
    expect(within(screen.getByRole('region', { name: 'Selected rows' })).getByRole('status')).toHaveTextContent('3 selected');
    expect(selectAll()).toHaveAttribute('aria-checked', 'true');

    // Page 2 is not part of it.
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    await screen.findByText('INV-1004', {}, SETTLE);
    expect(rowBox('INV-1004')).toHaveAttribute('aria-checked', 'false');
    expect(screen.queryByRole('region', { name: 'Selected rows' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    await screen.findByText('INV-1001', {}, SETTLE);
    await user.click(selectAll());
    expect(screen.queryByRole('region', { name: 'Selected rows' })).toBeNull();
  });

  it('exports only the selected rows', async () => {
    renderTable();
    await screen.findByText('INV-1001', {}, SETTLE);
    const user = userEvent.setup();
    await user.click(rowBox('INV-1001'));
    await user.click(rowBox('INV-1003'));
    await user.click(screen.getByRole('button', { name: 'Export selected (CSV)' }));

    expect(downloadCsv).toHaveBeenCalledTimes(1);
    const [filename] = vi.mocked(downloadCsv).mock.calls[0];
    expect(filename).toMatch(/^invoices-\d{4}-\d{2}-\d{2}\.csv$/);
    const lines = csvText().split('\r\n');
    expect(lines[0]).toBe('Invoice #,Customer,Status,Invoice Date,Amount,Balance Due');
    expect(lines).toHaveLength(3);
    expect(csvText()).toContain('INV-1001,Alpha Builders');
    expect(csvText()).toContain('INV-1003,Charlie Homes');
    expect(csvText()).not.toContain('INV-1002');
    // Nothing is fetched for it: the full-list export is a different button.
    expect(vi.mocked(invoiceService.searchInvoices).mock.calls.every(([req]) => req.limit !== 200)).toBe(true);
  });

  it('keeps the selection when the list is re-sorted', async () => {
    renderTable();
    await screen.findByText('INV-1001', {}, SETTLE);
    const user = userEvent.setup();
    await user.click(rowBox('INV-1002'));

    await user.click(screen.getByRole('button', { name: /^Balance Due/ }));
    await waitFor(() => {
      const order = screen.getAllByRole('checkbox', { name: /^Select invoice/ }).map((b) => b.getAttribute('aria-label'));
      expect(order).toEqual(['Select invoice INV-1001', 'Select invoice INV-1003', 'Select invoice INV-1002']);
    }, SETTLE);
    expect(rowBox('INV-1002')).toHaveAttribute('aria-checked', 'true');
    expect(within(screen.getByRole('region', { name: 'Selected rows' })).getByRole('status')).toHaveTextContent('1 selected');
  });

  it('clears the selection when the search changes', async () => {
    renderTable();
    await screen.findByText('INV-1001', {}, SETTLE);
    const user = userEvent.setup();
    await user.click(rowBox('INV-1001'));
    expect(screen.getByRole('region', { name: 'Selected rows' })).toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Search invoice #, customer, PO…'), 'a');
    expect(screen.queryByRole('region', { name: 'Selected rows' })).toBeNull();
    await waitFor(() => expect(rowBox('INV-1001')).toHaveAttribute('aria-checked', 'false'), SETTLE);
  });

  it('can be operated from the keyboard', async () => {
    renderTable();
    await screen.findByText('INV-1001', {}, SETTLE);
    const user = userEvent.setup();
    rowBox('INV-1002').focus();
    await user.keyboard(' ');
    expect(rowBox('INV-1002')).toHaveAttribute('aria-checked', 'true');
    selectAll().focus();
    await user.keyboard(' ');
    expect(selectAll()).toHaveAttribute('aria-checked', 'true');
  });

  it('offers no selection when there is nothing to select', async () => {
    renderTable(() => ({ records: [], nextCursor: '', hasMore: false, scope: 'all' as const }));
    await screen.findByText('No invoices added yet.', {}, SETTLE);
    expect(selectAll()).toBeDisabled();
    expect(selectedText()).toBeNull();
  });
});
