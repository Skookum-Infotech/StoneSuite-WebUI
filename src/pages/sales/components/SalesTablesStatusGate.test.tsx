import type { ComponentType } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('react-router-dom', async () => ({
  useNavigate: () => vi.fn(),
  Link: (await import('@/test/routerLinkStub')).RouterLinkStub,
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('@/services/estimateService', () => ({
  estimateService: { searchEstimates: vi.fn(), transition: vi.fn() },
}));
vi.mock('@/services/quoteService', () => ({
  quoteService: { searchQuotes: vi.fn(), transition: vi.fn() },
}));
vi.mock('@/services/salesOrderService', () => ({
  salesOrderService: { searchOrders: vi.fn(), transition: vi.fn() },
}));
vi.mock('@/services/invoiceService', () => ({
  invoiceService: { searchInvoices: vi.fn(), transition: vi.fn() },
}));
vi.mock('@/services/paymentService', () => ({
  paymentService: { searchPayments: vi.fn(), transition: vi.fn() },
}));
vi.mock('@/services/refundService', () => ({
  refundService: { searchRefunds: vi.fn(), transition: vi.fn() },
}));
vi.mock('@/services/fabricationService', () => ({
  fabricationService: { searchJobs: vi.fn(), transition: vi.fn() },
}));

import { EstimateTable } from './EstimateTable';
import { QuoteTable } from './QuoteTable';
import { SalesOrderTable } from './SalesOrderTable';
import { InvoiceTable } from './InvoiceTable';
import { PaymentTable } from './PaymentTable';
import { RefundTable } from './RefundTable';
import { FabricationJobTable } from './FabricationJobTable';
import { estimateService } from '@/services/estimateService';
import { quoteService } from '@/services/quoteService';
import { salesOrderService } from '@/services/salesOrderService';
import { invoiceService } from '@/services/invoiceService';
import { paymentService } from '@/services/paymentService';
import { refundService } from '@/services/refundService';
import { fabricationService } from '@/services/fabricationService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { EstimateSummary } from '@/types/estimate';
import type { QuoteSummary } from '@/types/quote';
import type { SalesOrderSummary } from '@/types/salesOrder';
import type { InvoiceSummary } from '@/types/invoice';
import type { PaymentSummary } from '@/types/payment';
import type { RefundSummary } from '@/types/refund';
import type { FabricationJob } from '@/types/fabrication';

// Only a super admin may change a Sales document's status from its list; every
// other user sees the status but gets no control for it (they move the record
// from its Detail page). One table-driven suite across all seven Sales lists
// so a new list can't quietly ship the dropdown to everyone.

const CUSTOMER = { id: 'c-1', name: 'Fontaine Builders' };

// Each fixture sits on a status that is neither grey (so the colour assertion
// can tell a real lookup from the neutral fallback) nor terminal (so a super
// admin's trigger genuinely opens). `tint` is the status colour from that
// module's *_STATUS_COLORS map + the pill's 0x18 alpha, as jsdom serialises it.
const ESTIMATE: EstimateSummary = {
  id: 'est-1', estimateNumber: 'EST-1001', status: 'Sent', statusCode: 'SENT', approvalStatus: 'none',
  nextStatusCodes: ['RJCT', 'EXPR', 'CANC'], customer: CUSTOMER, estimateDate: '2026-09-01', grandTotal: 1200,
};
const QUOTE: QuoteSummary = {
  id: 'q-1', quoteNumber: 'QTE-1001', status: 'Approved', statusCode: 'APPV', approvalStatus: 'none',
  nextStatusCodes: ['SENT', 'CANC'], customer: CUSTOMER, quoteDate: '2026-09-01', grandTotal: 1200,
};
const SALES_ORDER: SalesOrderSummary = {
  id: 'so-1', salesOrderNumber: 'SO-1001', status: 'Open', statusCode: 'OPEN', approvalStatus: 'none',
  nextStatusCodes: ['PART', 'FILL', 'CANC'], customer: CUSTOMER, orderDate: '2026-09-01', grandTotal: 1200,
};
const INVOICE: InvoiceSummary = {
  id: 'inv-1', invoiceNumber: 'INV-1001', status: 'Overdue', statusCode: 'ODUE', approvalStatus: 'none',
  nextStatusCodes: ['PART', 'PAID', 'VOID'], customer: CUSTOMER, invoiceDate: '2026-09-01', grandTotal: 1200,
  balanceDue: 1200,
};
const PAYMENT: PaymentSummary = {
  id: 'pay-1', paymentNumber: 'PAY-1001', status: 'Approved', statusCode: 'APPV', approvalStatus: 'none',
  customer: CUSTOMER, paymentDate: '2026-09-01', amount: 500, unappliedAmount: 500,
};
const REFUND: RefundSummary = {
  id: 'ref-1', refundNumber: 'REF-1001', status: 'Approved', statusCode: 'APPV', approvalStatus: 'none',
  customer: CUSTOMER, refundDate: '2026-09-01', amount: 500, unappliedAmount: 0, reason: 'Duplicate charge',
};
const FABRICATION_JOB: FabricationJob = {
  id: 'fj-1', jobNumber: 'FJ-1001', status: 'Cutting', statusCode: 'CUTG', approvalStatus: 'none',
  gated: false, approvers: [], requiredApprovals: 0, approvedCount: 0, canApprove: false, isOverride: false,
  callerAlreadyApproved: false, salesOrderId: 'so-1', customer: CUSTOMER, cancelRequested: false, site: {},
  ownerEmployeeId: null, templaterEmployeeId: null, fabricatorEmployeeId: null, installCrewEmployeeId: null,
  createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
};

function page<T>(records: T[]) {
  return { records, nextCursor: '', hasMore: false, scope: 'all' };
}

interface StatusGateCase {
  table: string;
  Table: ComponentType;
  /** Makes the module's search endpoint return the one fixture row. */
  serve: () => void;
  recordNumber: string;
  status: string;
  tint: string;
}

const CASES: StatusGateCase[] = [
  {
    table: 'EstimateTable', Table: EstimateTable, recordNumber: 'EST-1001', status: 'Sent',
    tint: 'rgba(99, 102, 241, 0.094)',
    serve: () => vi.mocked(estimateService.searchEstimates).mockResolvedValue(page([ESTIMATE])),
  },
  {
    table: 'QuoteTable', Table: QuoteTable, recordNumber: 'QTE-1001', status: 'Approved',
    tint: 'rgba(59, 130, 246, 0.094)',
    serve: () => vi.mocked(quoteService.searchQuotes).mockResolvedValue(page([QUOTE])),
  },
  {
    table: 'SalesOrderTable', Table: SalesOrderTable, recordNumber: 'SO-1001', status: 'Open',
    tint: 'rgba(99, 102, 241, 0.094)',
    serve: () => vi.mocked(salesOrderService.searchOrders).mockResolvedValue(page([SALES_ORDER])),
  },
  {
    table: 'InvoiceTable', Table: InvoiceTable, recordNumber: 'INV-1001', status: 'Overdue',
    tint: 'rgba(239, 68, 68, 0.094)',
    serve: () => vi.mocked(invoiceService.searchInvoices).mockResolvedValue(page([INVOICE])),
  },
  {
    table: 'PaymentTable', Table: PaymentTable, recordNumber: 'PAY-1001', status: 'Approved',
    tint: 'rgba(59, 130, 246, 0.094)',
    serve: () => vi.mocked(paymentService.searchPayments).mockResolvedValue(page([PAYMENT])),
  },
  {
    table: 'RefundTable', Table: RefundTable, recordNumber: 'REF-1001', status: 'Approved',
    tint: 'rgba(59, 130, 246, 0.094)',
    serve: () => vi.mocked(refundService.searchRefunds).mockResolvedValue(page([REFUND])),
  },
  {
    table: 'FabricationJobTable', Table: FabricationJobTable, recordNumber: 'FJ-1001', status: 'Cutting',
    tint: 'rgba(245, 158, 11, 0.094)',
    serve: () => vi.mocked(fabricationService.searchJobs).mockResolvedValue(page([FABRICATION_JOB])),
  },
];

// Every permission granted; `isSuperAdmin` is the only thing that decides
// whether the list row's status is a dropdown or a read-only pill.
function mockPermissions(isSuperAdmin: boolean) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [],
    isLoading: false,
    activeRoleId: '',
    isSuperAdmin,
    hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
}

async function renderRow({ Table, serve, recordNumber }: StatusGateCase): Promise<HTMLElement> {
  serve();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={queryClient}>
      <Table />
    </QueryClientProvider>,
  );
  const tableRow = (await screen.findByText(recordNumber)).closest('tr');
  expect(tableRow).not.toBeNull();
  return tableRow as HTMLElement;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe.each(CASES)('$table status cell', (gateCase) => {
  const { status, tint } = gateCase;

  it('gives a non-admin the status as a tinted, read-only pill with no control to change it', async () => {
    mockPermissions(false);
    const row = await renderRow(gateCase);

    expect(within(row).queryByRole('button', { name: status })).not.toBeInTheDocument();
    expect(within(row).getByText(status)).toHaveStyle({ backgroundColor: tint });
  });

  it('gives a super admin the status dropdown, which opens', async () => {
    const user = userEvent.setup();
    mockPermissions(true);
    const row = await renderRow(gateCase);

    await user.click(within(row).getByRole('button', { name: status }));

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });
});
