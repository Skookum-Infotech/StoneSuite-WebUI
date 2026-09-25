import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/services/vendorBillService', () => ({
  vendorBillService: {
    getVendorBill: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    transition: vi.fn(),
    deleteVendorBill: vi.fn(),
  },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
// Not under test — the tabs and the send dialog fetch their own data.
vi.mock('./components/BillPaymentsTab', () => ({ BillPaymentsTab: () => null }));
vi.mock('./components/VendorBillAuditTab', () => ({ VendorBillAuditTab: () => null }));
vi.mock('@/components/crm/CrmSubTabsPanel', () => ({ FilesContent: () => null }));
vi.mock('@/components/tenant/SendToCustomerDialog', () => ({ SendToCustomerDialog: () => null }));

import VendorBillDetailPage from './VendorBillDetailPage';
import { vendorBillService } from '@/services/vendorBillService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { toast } from 'sonner';
import type { VendorBill } from '@/types/vendorBill';

function bill(over: Partial<VendorBill> = {}): VendorBill {
  return {
    id: 'vb-1', vendorBillNumber: 'VB-1001', status: 'Approved', statusCode: 'APPV',
    approvalStatus: 'approved', gated: false, approvers: [], requiredApprovals: 0, approvedCount: 0,
    canApprove: false, isOverride: false, callerAlreadyApproved: false,
    vendor: { id: 'v-1', name: 'Marble Supply Co' },
    vendorInvoiceNumber: '', referenceNumber: '', billDate: '2026-09-01',
    paymentTermsId: null, currencyId: null, exchangeRate: 1, salesTaxPercent: 0,
    memo: '', notes: '', internalNotes: '', termsConditions: '',
    subtotal: 100, discountTotal: 0, taxTotal: 0, adjustment: 0, grandTotal: 100, amountPaid: 0, balanceDue: 100,
    items: [], createdAt: '2026-09-01T00:00:00Z', updatedAt: '2026-09-01T00:00:00Z',
    ...over,
  };
}

function renderPage({ denied = [] as string[] } = {}) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    // `denied` lists "resource:action" grants to withhold; everything else is allowed.
    hasPermission: (resource: string, action: string) => !denied.includes(`${resource}:${action}`),
  } as ReturnType<typeof useUserPermissions>);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/purchases/vendor_bill/vb-1']}>
        <Routes>
          <Route path="/purchases/vendor_bill/:id" element={<VendorBillDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// Two things render twice in this page's DOM (CSS hides one; jsdom sees both):
// CrmPageHeader's actions (mobile + desktop layouts) and everything inside
// SalesDetailSidebar (inline on lg+, and again in a bottom sheet below lg). So
// buttons are matched with the *AllBy* queries and the first is used.
const VOID_NAME = 'Void Vendor Bill VB-1001';
const buttonsNamed = (name: string) => screen.queryAllByRole('button', { name });
const firstButton = async (name: string) => (await screen.findAllByRole('button', { name }))[0];
// The sidebar's mobile sheet is a permanent role="dialog" ("Vendor Bill Details"),
// so the confirmation is told apart by its title.
const PAID_DIALOG = 'Mark VB-1001 as Paid?';
const VOID_DIALOG = 'Void VB-1001?';
const anyConfirmDialog = () => screen.queryByRole('dialog', { name: /^(Mark .+ as Paid|Void .+)\?$/ });
// The vendor's name also appears in the header and sidebar; waiting on it just
// means "the bill has loaded".
const loaded = () => screen.findAllByText('Marble Supply Co');

beforeEach(() => vi.clearAllMocks());

describe('VendorBillDetailPage — status buttons', () => {
  it('shows the settlement moves as header buttons and Void in the Danger Zone, not the pill', async () => {
    vi.mocked(vendorBillService.getVendorBill).mockResolvedValue(bill());
    renderPage();

    expect(await firstButton('Mark Overdue')).toBeInTheDocument();
    expect(await firstButton('Mark Partially Paid')).toBeInTheDocument();
    expect(await firstButton('Mark Paid')).toBeInTheDocument();
    expect(buttonsNamed(VOID_NAME).length).toBeGreaterThan(0);
    // Nothing left for the pill from Approved, so its card is not an empty "Actions" header.
    expect(screen.queryAllByText('Actions')).toHaveLength(0);
  });

  it('fires Overdue straight away, with no confirmation', async () => {
    vi.mocked(vendorBillService.getVendorBill).mockResolvedValue(bill());
    vi.mocked(vendorBillService.transition).mockResolvedValue(bill({ status: 'Overdue', statusCode: 'ODUE' }));
    renderPage();

    await userEvent.setup().click(await firstButton('Mark Overdue'));

    await waitFor(() => expect(vendorBillService.transition).toHaveBeenCalledWith('vb-1', 'ODUE'));
    expect(anyConfirmDialog()).not.toBeInTheDocument();
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Moved to Overdue.'));
  });

  it('asks before marking Paid, and only moves the bill once confirmed', async () => {
    vi.mocked(vendorBillService.getVendorBill).mockResolvedValue(bill());
    vi.mocked(vendorBillService.transition).mockResolvedValue(bill({ status: 'Paid', statusCode: 'PAID', balanceDue: 0 }));
    renderPage();
    const user = userEvent.setup();

    await user.click(await firstButton('Mark Paid'));

    const dialog = await screen.findByRole('dialog', { name: PAID_DIALOG });
    expect(vendorBillService.transition).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Mark Paid' }));

    await waitFor(() => expect(vendorBillService.transition).toHaveBeenCalledWith('vb-1', 'PAID'));
    await waitFor(() => expect(anyConfirmDialog()).not.toBeInTheDocument());
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Moved to Paid.'));
  });

  it('does nothing when the Paid confirmation is cancelled', async () => {
    vi.mocked(vendorBillService.getVendorBill).mockResolvedValue(bill());
    renderPage();
    const user = userEvent.setup();

    await user.click(await firstButton('Mark Paid'));
    await user.click(within(await screen.findByRole('dialog', { name: PAID_DIALOG })).getByRole('button', { name: 'Cancel' }));

    expect(anyConfirmDialog()).not.toBeInTheDocument();
    expect(vendorBillService.transition).not.toHaveBeenCalled();
  });

  it('voids from the Danger Zone, after confirming', async () => {
    vi.mocked(vendorBillService.getVendorBill).mockResolvedValue(bill());
    vi.mocked(vendorBillService.transition).mockResolvedValue(bill({ status: 'Void', statusCode: 'VOID' }));
    renderPage();
    const user = userEvent.setup();

    await user.click(await firstButton(VOID_NAME));

    const dialog = await screen.findByRole('dialog', { name: VOID_DIALOG });
    expect(vendorBillService.transition).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Void vendor bill' }));

    await waitFor(() => expect(vendorBillService.transition).toHaveBeenCalledWith('vb-1', 'VOID'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Moved to Void.'));
  });

  it('closes the dialog and shows the server error under the header when the move fails', async () => {
    vi.mocked(vendorBillService.getVendorBill).mockResolvedValue(bill());
    vi.mocked(vendorBillService.transition).mockRejectedValue(new Error('Cannot mark this bill paid.'));
    renderPage();
    const user = userEvent.setup();

    await user.click(await firstButton('Mark Paid'));
    await user.click(within(await screen.findByRole('dialog', { name: PAID_DIALOG })).getByRole('button', { name: 'Mark Paid' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot mark this bill paid.');
    expect(anyConfirmDialog()).not.toBeInTheDocument();
  });

  it('keeps the approval moves in the sidebar pill on a draft, with Void above Delete in the Danger Zone', async () => {
    vi.mocked(vendorBillService.getVendorBill).mockResolvedValue(bill({
      status: 'Draft', statusCode: 'DRFT', approvalStatus: 'none', nextStatusCodes: ['PAPV', 'VOID'],
    }));
    renderPage();

    expect((await screen.findAllByText('Actions')).length).toBeGreaterThan(0);
    expect(buttonsNamed('Mark Paid')).toHaveLength(0);
    const voidBtn = await firstButton(VOID_NAME);
    const deleteBtn = await firstButton('Delete Vendor Bill VB-1001');
    expect(voidBtn.compareDocumentPosition(deleteBtn) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('offers nothing to void or pay on a bill that is already Paid', async () => {
    vi.mocked(vendorBillService.getVendorBill).mockResolvedValue(bill({ status: 'Paid', statusCode: 'PAID' }));
    renderPage();

    await loaded();
    expect(buttonsNamed('Mark Paid')).toHaveLength(0);
    expect(buttonsNamed(VOID_NAME)).toHaveLength(0);
    expect(screen.queryAllByText('Actions')).toHaveLength(0);
  });

  it('disables Void, with the reason, while the bill awaits approval', async () => {
    vi.mocked(vendorBillService.getVendorBill).mockResolvedValue(bill({
      status: 'Pending Approval', statusCode: 'PAPV', approvalStatus: 'pending', gated: true,
      nextStatusCodes: ['APPV', 'DRFT', 'VOID'],
    }));
    renderPage();

    expect(await firstButton(VOID_NAME)).toBeDisabled();
    expect(screen.getAllByText('Awaiting approval sign-off').length).toBeGreaterThan(0);
  });

  it('shows no status button at all without vendor_bill:transition', async () => {
    vi.mocked(vendorBillService.getVendorBill).mockResolvedValue(bill());
    renderPage({ denied: ['vendor_bill:transition'] });

    await loaded();
    for (const name of ['Mark Overdue', 'Mark Partially Paid', 'Mark Paid', VOID_NAME]) {
      expect(buttonsNamed(name)).toHaveLength(0);
    }
  });
});
