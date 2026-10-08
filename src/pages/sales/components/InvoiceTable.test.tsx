import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/invoiceService', () => ({
  invoiceService: { searchInvoices: vi.fn(), transition: vi.fn() },
}));

import { InvoiceTable } from './InvoiceTable';
import { invoiceService } from '@/services/invoiceService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { InvoiceSummary } from '@/types/invoice';

function mockPermissions() {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '', isSuperAdmin: false,
    hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
}

function draftInvoice(nextStatusCodes: string[]): InvoiceSummary {
  return {
    id: 'inv-1',
    invoiceNumber: 'INV-1001',
    status: 'Draft',
    statusCode: 'DRFT',
    approvalStatus: 'none',
    nextStatusCodes,
    customer: { id: 'c-1', name: 'Fontaine Builders' },
    invoiceDate: '2026-09-01',
    grandTotal: 1200,
    balanceDue: 1200,
  };
}

async function renderWithRow(row: InvoiceSummary): Promise<HTMLElement> {
  vi.mocked(invoiceService.searchInvoices).mockResolvedValue({
    records: [row], nextCursor: '', hasMore: false, scope: 'all',
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <InvoiceTable />
    </QueryClientProvider>,
  );
  const tableRow = (await screen.findByText(row.invoiceNumber)).closest('tr');
  expect(tableRow).not.toBeNull();
  return tableRow as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

// The list row's status pill must offer the record's own nextStatusCodes (what
// the backend computed, with an approval checkpoint nobody is configured to
// approve collapsed out) -- not the static transition map, which always leads
// Draft through "Submit for Approval".
describe('InvoiceTable status pill', () => {
  it('offers Sent directly from Draft, with no approval step, when nobody is configured to approve', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const row = await renderWithRow(draftInvoice(['SENT', 'VOID']));

    await user.click(within(row).getByRole('button', { name: 'Draft' }));

    expect(screen.getByRole('option', { name: 'Sent' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Submit for Approval' })).not.toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Approved' })).not.toBeInTheDocument();
  });

  it('still offers Submit for Approval when an approver is configured', async () => {
    const user = userEvent.setup();
    mockPermissions();
    const row = await renderWithRow(draftInvoice(['PAPV', 'VOID']));

    await user.click(within(row).getByRole('button', { name: 'Draft' }));

    expect(screen.getByRole('option', { name: 'Submit for Approval' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Sent' })).not.toBeInTheDocument();
  });
});

// Below the sm breakpoint the table keeps only what identifies and prices an invoice, so
// Status and Balance Due stay on screen instead of scrolling sideways.
describe('InvoiceTable phone layout', () => {
  const PHONE_HIDDEN = 'max-sm:hidden';

  it.each([
    ['Invoice #', false],
    ['Customer', false],
    ['Status', false],
    ['Balance Due', false],
    ['Invoice Date', true],
    ['Amount', true],
    ['Actions', true],
  ])('column %s is hidden on phones: %s', async (name, hidden) => {
    mockPermissions();
    await renderWithRow(draftInvoice([]));
    const header = screen.getByRole('columnheader', { name });
    expect(header.classList.contains(PHONE_HIDDEN)).toBe(hidden);
  });

  it('hides the same row cells as the header, so the columns stay aligned', async () => {
    mockPermissions();
    const row = await renderWithRow(draftInvoice([]));
    const headers = screen.getAllByRole('columnheader');
    const cells = within(row).getAllByRole('cell');
    expect(cells.map((c) => c.classList.contains(PHONE_HIDDEN)))
      .toEqual(headers.map((h) => h.classList.contains(PHONE_HIDDEN)));
  });
});
