import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, type AxiosResponse } from 'axios';

vi.mock('@/services/purchaseOrderService', () => ({
  purchaseOrderService: {
    getPurchaseOrder: vi.fn(),
    approve: vi.fn(),
    reject: vi.fn(),
    transition: vi.fn(),
    convertToBill: vi.fn(),
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

function renderPage({ isSuperAdmin = false, denied = [] as string[] } = {}) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin,
    // `denied` lists "resource:action" grants to withhold; everything else is allowed.
    hasPermission: (resource: string, action: string) => !denied.includes(`${resource}:${action}`),
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

const approvedOrder = {
  ...pendingOrder,
  status: 'Approved', statusCode: 'APPV', approvalStatus: 'approved', nextStatusCodes: ['SENT', 'DRFT', 'CANC'],
  gated: false, canApprove: false, canReject: false,
} as unknown as PurchaseOrder;

const sentOrder = {
  ...approvedOrder,
  status: 'Sent', statusCode: 'SENT', nextStatusCodes: ['PART', 'RCVD', 'CLSD', 'CANC'],
} as unknown as PurchaseOrder;

// jsdom applies no CSS, so both of CrmPageHeader's layouts (mobile row and
// desktop row) render their `actions`, and SalesDetailSidebar renders its
// children twice (inline + the mobile sheet). A control in the header therefore
// appears HEADER_COPIES times and one in the sidebar SIDEBAR_COPIES times.
const HEADER_COPIES = 2;
const SIDEBAR_COPIES = 2;

// Send to Vendor / Submit for Approval / Receive items are header buttons; the
// status dropdown is a super-admin control that no longer carries those moves.
describe('PurchaseOrderDetailPage — header actions and the admin-only status dropdown', () => {
  it('lets a non-admin send an approved order to the vendor from the header, with no status dropdown', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue(approvedOrder);
    vi.mocked(purchaseOrderService.transition).mockResolvedValue(sentOrder);
    renderPage();
    const user = userEvent.setup();

    const sendButtons = await screen.findAllByRole('button', { name: 'Send to Vendor' });
    expect(sendButtons).toHaveLength(HEADER_COPIES);
    expect(screen.queryAllByText('Actions')).toHaveLength(0);
    expect(screen.queryAllByRole('button', { name: 'Approved' })).toHaveLength(0);

    await user.click(sendButtons[0]);

    await waitFor(() => expect(purchaseOrderService.transition).toHaveBeenCalledWith('po-1', 'SENT'));
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('Moved to Sent.'));
  });

  it('lets a non-admin submit a Draft for approval from the header', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue({
      ...approvedOrder, status: 'Draft', statusCode: 'DRFT', approvalStatus: 'none', nextStatusCodes: ['PAPV', 'CANC'],
    } as unknown as PurchaseOrder);
    vi.mocked(purchaseOrderService.transition).mockResolvedValue(pendingOrder);
    renderPage();
    const user = userEvent.setup();

    const submitButtons = await screen.findAllByRole('button', { name: 'Submit for Approval' });
    expect(submitButtons).toHaveLength(HEADER_COPIES);
    expect(screen.queryAllByText('Actions')).toHaveLength(0);

    await user.click(submitButtons[0]);

    await waitFor(() => expect(purchaseOrderService.transition).toHaveBeenCalledWith('po-1', 'PAPV'));
  });

  it('gives a super admin the status dropdown, without the moves that are header buttons', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue(approvedOrder);
    renderPage({ isSuperAdmin: true });
    const user = userEvent.setup();

    expect(await screen.findAllByText('Actions')).toHaveLength(SIDEBAR_COPIES);
    expect(screen.getAllByRole('button', { name: 'Send to Vendor' })).toHaveLength(HEADER_COPIES);
    await user.click(screen.getAllByRole('button', { name: 'Approved' })[0]);

    expect(screen.getByRole('option', { name: 'Revise' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Cancel' })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: 'Send to Vendor' })).not.toBeInTheDocument();
  });

  it('hides the status dropdown from a super admin once only header-button moves remain', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue({
      ...approvedOrder, nextStatusCodes: ['SENT'],
    } as unknown as PurchaseOrder);
    renderPage({ isSuperAdmin: true });

    expect(await screen.findAllByRole('button', { name: 'Send to Vendor' })).toHaveLength(HEADER_COPIES);
    expect(screen.queryAllByText('Actions')).toHaveLength(0);
  });

  it('shows Receive items in the header, not the sidebar, for a receivable order', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue(sentOrder);
    renderPage();

    // Exactly the header's copies: were it still a sidebar Quick Action there would be more.
    expect(await screen.findAllByRole('button', { name: 'Receive items' })).toHaveLength(HEADER_COPIES);
  });

  it('offers no Receive items on an order that cannot be received against', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue(approvedOrder);
    renderPage();

    await screen.findAllByRole('button', { name: 'Send to Vendor' });
    expect(screen.queryAllByRole('button', { name: 'Receive items' })).toHaveLength(0);
  });

  it('surfaces a refusal from the backend even though a non-admin has no Actions card to show it in', async () => {
    const refusal = 'Only an administrator can move a purchase order to that status.';
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue(approvedOrder);
    vi.mocked(purchaseOrderService.transition).mockRejectedValue(
      new AxiosError('Request failed with status code 403', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 403, data: { success: false, message: refusal },
      } as AxiosResponse),
    );
    renderPage();
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole('button', { name: 'Send to Vendor' }))[0]);

    expect(await screen.findByRole('alert')).toHaveTextContent(refusal);
  });
});

// Create Bill is a header button (it used to be a sidebar "Convert to Bill"
// action). It bills what has been received and not yet billed, so it is offered
// on a partly received order and disappears once everything received is billed.
describe('PurchaseOrderDetailPage — Create Bill', () => {
  const line = (id: string, n: number, quantity: number, qtyReceived: number, qtyBilled: number) => ({
    id, lineNumber: n, itemName: `Item ${n}`, description: '', quantity, qtyReceived, qtyBilled,
    unitPrice: 25, discountPercent: 0, taxPercent: 0, lineSubtotal: 0, lineDiscount: 0, lineTax: 0, lineTotal: 0,
  });
  const partlyReceived = {
    ...approvedOrder,
    status: 'Partially Received', statusCode: 'PART', nextStatusCodes: ['RCVD', 'CLSD'],
    items: [line('l1', 1, 10, 4, 0), line('l2', 2, 5, 0, 0)],
  } as unknown as PurchaseOrder;

  it('offers Create Bill in the header of a partly received order, not in the sidebar', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue(partlyReceived);
    renderPage();

    expect(await screen.findAllByRole('button', { name: 'Create Bill' })).toHaveLength(HEADER_COPIES);
    expect(screen.queryByRole('button', { name: /Convert this purchase order to a vendor bill/i })).not.toBeInTheDocument();
    expect(screen.queryByText('Convert to Bill')).not.toBeInTheDocument();
  });

  it('lists only what has been received and not yet billed, then bills it', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue(partlyReceived);
    vi.mocked(purchaseOrderService.convertToBill).mockResolvedValue({ id: 'vb-1' } as never);
    renderPage();
    const user = userEvent.setup();

    await user.click((await screen.findAllByRole('button', { name: 'Create Bill' }))[0]);

    const list = await screen.findByRole('list', { name: 'Lines on the new bill' });
    expect(list).toHaveTextContent('1. Item 1');
    expect(list).toHaveTextContent('4 of 10 ordered');
    expect(list).not.toHaveTextContent('Item 2'); // nothing received on it
    await user.click(screen.getByRole('button', { name: 'Create vendor bill' }));

    await waitFor(() => expect(purchaseOrderService.convertToBill).toHaveBeenCalledWith('po-1'));
  });

  it('is hidden once everything received has been billed', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue({
      ...partlyReceived, items: [line('l1', 1, 10, 4, 4)],
    } as unknown as PurchaseOrder);
    renderPage();

    await screen.findAllByText('Partially Received');
    expect(screen.queryAllByRole('button', { name: 'Create Bill' })).toHaveLength(0);
  });

  it.each([
    ['Sent, nothing received', { status: 'Sent', statusCode: 'SENT', items: [line('l1', 1, 10, 0, 0)] }],
    ['Approved', { items: [line('l1', 1, 10, 10, 0)] }],
  ])('is hidden on an order that is %s', async (_label, overrides) => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue({ ...approvedOrder, ...overrides } as unknown as PurchaseOrder);
    renderPage();

    await screen.findAllByText(/Approved|Sent/);
    expect(screen.queryAllByRole('button', { name: 'Create Bill' })).toHaveLength(0);
  });

  it('is offered on a fully received order that still has goods to bill', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue({
      ...partlyReceived, status: 'Received', statusCode: 'RCVD', nextStatusCodes: ['CLSD'],
      items: [line('l1', 1, 10, 10, 6)],
    } as unknown as PurchaseOrder);
    renderPage();

    expect(await screen.findAllByRole('button', { name: 'Create Bill' })).toHaveLength(HEADER_COPIES);
  });

  it('is hidden without permission to create vendor bills', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue(partlyReceived);
    renderPage({ denied: ['vendor_bill:create'] });

    await screen.findAllByText('Partially Received');
    expect(screen.queryAllByRole('button', { name: 'Create Bill' })).toHaveLength(0);
  });
});

// Receiving now saves and posts in one step, so it takes both item-receipt grants.
describe('PurchaseOrderDetailPage — Receive items permissions', () => {
  const sentReceivable = { ...sentOrder, items: [] } as unknown as PurchaseOrder;

  it('is offered with both item_receipt:create and item_receipt:transition', async () => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue(sentReceivable);
    renderPage();

    expect(await screen.findAllByRole('button', { name: 'Receive items' })).toHaveLength(HEADER_COPIES);
  });

  it.each(['item_receipt:create', 'item_receipt:transition'])('is hidden without %s', async (denied) => {
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue(sentReceivable);
    renderPage({ denied: [denied] });

    await screen.findAllByText('Sent');
    expect(screen.queryAllByRole('button', { name: 'Receive items' })).toHaveLength(0);
  });
});
