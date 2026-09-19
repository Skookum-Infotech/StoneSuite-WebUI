import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

vi.mock('@/services/purchaseOrderService', () => ({
  purchaseOrderService: {
    getPurchaseOrder: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    transition: vi.fn(),
  },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import PurchaseOrderDetailPage from './PurchaseOrderDetailPage';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { toast } from 'sonner';
import type { PurchaseOrder } from '@/types/purchaseOrder';

const address = { line1: '', line2: '', city: '', state: '', postalCode: '', country: '' };

// A purchase order sitting on its approval gate, as the approver sees it.
const pendingOrder = {
  id: 'po-1',
  purchaseOrderNumber: 'PO-000001',
  status: 'Pending Approval',
  statusCode: 'PAPV',
  approvalStatus: 'pending',
  nextStatusCodes: ['CANC', 'DRFT'],
  gated: true,
  approvers: [{ id: 'a1', name: 'Alice Approver', approved: false }],
  requiredApprovals: 1,
  approvedCount: 0,
  canApprove: true,
  isOverride: false,
  callerAlreadyApproved: false,
  canReject: true,
  vendor: { id: 'v1', name: 'Nero Marble Co' },
  orderDate: '2026-09-01',
  salesTaxPercent: 0,
  shipTo: address,
  subtotal: 100, discountTotal: 0, taxTotal: 0, shippingCharge: 0, adjustment: 0, grandTotal: 100,
  items: [],
  createdAt: '2026-09-01T00:00:00Z',
  updatedAt: '2026-09-01T00:00:00Z',
} as unknown as PurchaseOrder;

function renderPage() {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '',
    hasPermission: () => true,
  } as ReturnType<typeof useUserPermissions>);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/purchases/purchase_order/po-1']}>
        <Routes>
          <Route path="/purchases/purchase_order/:id" element={<PurchaseOrderDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => vi.clearAllMocks());

describe('PurchaseOrderDetailPage — approver Reject', () => {
  it('lets an approver reject with a reason, then refetches and confirms', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue(pendingOrder);
    vi.mocked(purchaseOrderService.reject).mockResolvedValue({ ...pendingOrder, statusCode: 'DRFT' });
    renderPage();
    const user = userEvent.setup();

    expect(await screen.findByRole('button', { name: 'Approve this record' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reject this purchase order' }));
    await user.type(screen.getByRole('textbox', { name: 'Rejection reason' }), 'Vendor is wrong');
    await user.click(screen.getByRole('button', { name: 'Reject purchase order' }));

    await waitFor(() => expect(purchaseOrderService.reject).toHaveBeenCalledWith('po-1', 'Vendor is wrong'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Rejected — sent back to Draft.'));
    // the page refetches so the rejection banner (part of the approval overlay) shows up
    await waitFor(() => expect(vi.mocked(purchaseOrderService.getPurchaseOrder).mock.calls.length).toBeGreaterThan(1));
  });

  it('shows the rejection, with no Approve or Reject, on a Draft that was sent back', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue({
      ...pendingOrder,
      status: 'Draft', statusCode: 'DRFT', approvalStatus: 'none', nextStatusCodes: ['PAPV', 'CANC'],
      gated: false, canApprove: false, canReject: false,
      rejection: { byName: 'Alice Approver', reason: 'Vendor is wrong', at: '2026-09-19T10:00:00Z' },
    });
    renderPage();

    expect(await screen.findByText(/Alice Approver: "Vendor is wrong"/)).toBeInTheDocument();
    expect(screen.getByText(/submit it for approval again/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Approve this record' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject this purchase order' })).not.toBeInTheDocument();
  });

  it('offers no Reject to someone who is not an approver', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue({ ...pendingOrder, canApprove: false, canReject: false });
    renderPage();

    expect(await screen.findByText(/Awaiting approval from Alice Approver/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reject this purchase order' })).not.toBeInTheDocument();
  });
});
