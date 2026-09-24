import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AxiosError, type AxiosResponse } from 'axios';
import type * as ReactRouterDom from 'react-router-dom';

const navigateMock = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactRouterDom>()),
  useNavigate: () => navigateMock,
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));
// The guard blocks navigation via a data router; this page is exercised under a
// plain MemoryRouter, and the guard itself is not what is being tested here.
vi.mock('@/hooks/useUnsavedChangesGuard', () => ({ useUnsavedChangesGuard: () => ({ markClean: vi.fn() }) }));
vi.mock('@/components/UnsavedChangesPrompt', () => ({ UnsavedChangesPrompt: () => null }));
// The form body pulls in lookups, the files panel and every field; the page's
// save behaviour does not depend on it.
vi.mock('./components/ItemReceiptFormBody', () => ({ ItemReceiptFormBody: () => null }));
vi.mock('@/services/itemReceiptService', () => ({ itemReceiptService: { createItemReceipt: vi.fn() } }));
vi.mock('@/services/purchaseOrderService', () => ({ purchaseOrderService: { getPurchaseOrder: vi.fn() } }));
vi.mock('@/services/lookupService', () => ({ lookupService: { getCrmLookups: vi.fn().mockResolvedValue({}) } }));

import ReceiveItemsPage from './ReceiveItemsPage';
import { itemReceiptService } from '@/services/itemReceiptService';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { OVER_RECEIPT_MESSAGE } from '@/lib/itemReceiptErrors';
import { toast } from 'sonner';
import type { PurchaseOrder } from '@/types/purchaseOrder';
import type { ItemReceipt } from '@/types/itemReceipt';

const SAVE_LABEL = 'Save & Post Receipt';

const sentOrder = {
  id: 'po-1',
  purchaseOrderNumber: 'PO-000001',
  status: 'Sent',
  statusCode: 'SENT',
  vendor: { id: 'v1', name: 'Nero Marble Co' },
  items: [{
    id: 'poi-1', lineNumber: 1, inventoryItemId: 'inv-1', sku: 'SKU-1', itemName: 'Slab', description: '',
    unitCode: 'EA', quantity: 10, qtyReceived: 0, qtyBilled: 0,
  }],
} as unknown as PurchaseOrder;

const posted = { id: 'ir-1', itemReceiptNumber: 'IRCT-000001', statusCode: 'RCVD' } as unknown as ItemReceipt;

function overReceiptError(): AxiosError {
  const message = `item receipt: ${OVER_RECEIPT_MESSAGE}: line 1 (ordered 10, already received 0, receiving 50)`;
  return new AxiosError('Request failed with status code 403', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 403, data: { success: false, message },
  } as AxiosResponse);
}

function renderPage({ canApprove = false } = {}) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => resource === 'item_receipt' && action === 'approve' ? canApprove : true,
  } as ReturnType<typeof useUserPermissions>);
  vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue(sentOrder);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/purchases/item_receipt/new?po=po-1']}>
        <Routes>
          <Route path="/purchases/item_receipt/new" element={<ReceiveItemsPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

// The header shows the submit button in both its mobile and desktop layouts
// (jsdom applies no CSS), and the action bar has one more; any of them submits.
async function clickSave(user: ReturnType<typeof userEvent.setup>) {
  const [button] = await screen.findAllByRole('button', { name: SAVE_LABEL });
  await user.click(button);
}

beforeEach(() => {
  vi.clearAllMocks();
  // jsdom has no scrollIntoView; the page scrolls its error banner into view.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('ReceiveItemsPage — saving posts the receipt', () => {
  it('creates and posts in one request, then lands on the posted receipt', async () => {
    vi.mocked(itemReceiptService.createItemReceipt).mockResolvedValue(posted);
    renderPage();

    await clickSave(userEvent.setup());

    await waitFor(() => expect(itemReceiptService.createItemReceipt).toHaveBeenCalledOnce());
    const payload = vi.mocked(itemReceiptService.createItemReceipt).mock.calls[0][0];
    expect(payload).toMatchObject({ purchaseOrderUuid: 'po-1', post: true });
    expect(payload.overReceiptReason).toBeUndefined();
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toMatchObject({ qtyReceived: 10 });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/purchases/item_receipt/ir-1'));
    expect(toast.success).toHaveBeenCalledWith('Item receipt IRCT-000001 posted.');
  });

  it('says up front that saving posts and moves stock', async () => {
    renderPage();

    expect((await screen.findAllByText(/Saving posts the receipt and moves stock/)).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Save Item Receipt' })).not.toBeInTheDocument();
  });

  it('shows an unrelated failure in the page banner, with no over-receipt dialog', async () => {
    vi.mocked(itemReceiptService.createItemReceipt).mockRejectedValue(
      new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
        status: 409, data: { success: false, message: 'purchase order is not open for receiving' },
      } as AxiosResponse),
    );
    renderPage();

    await clickSave(userEvent.setup());

    expect(await screen.findByRole('alert')).toHaveTextContent('purchase order is not open for receiving');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});

describe('ReceiveItemsPage — a delivery over the ordered quantity', () => {
  it('lets an approver confirm with a reason, which re-sends the whole receipt', async () => {
    vi.mocked(itemReceiptService.createItemReceipt)
      .mockRejectedValueOnce(overReceiptError())
      .mockResolvedValueOnce(posted);
    renderPage({ canApprove: true });
    const user = userEvent.setup();

    await clickSave(user);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('This exceeds the ordered quantity');
    expect(dialog).toHaveTextContent('Line 1 — ordered 10, already received 0, receiving 50');
    // The dialog carries the explanation; the page banner would only repeat it.
    expect(screen.queryByText(/Failed to save and post item receipt/)).not.toBeInTheDocument();

    const confirm = screen.getByRole('button', { name: 'Confirm & Post' });
    expect(confirm).toBeDisabled(); // a reason is required
    await user.type(screen.getByRole('textbox', { name: 'Over-receipt reason' }), 'Vendor shipped a full pallet');
    await user.click(confirm);

    await waitFor(() => expect(itemReceiptService.createItemReceipt).toHaveBeenCalledTimes(2));
    const retry = vi.mocked(itemReceiptService.createItemReceipt).mock.calls[1][0];
    expect(retry).toMatchObject({
      purchaseOrderUuid: 'po-1', post: true, overReceiptReason: 'Vendor shipped a full pallet',
    });
    await waitFor(() => expect(navigateMock).toHaveBeenCalledWith('/purchases/item_receipt/ir-1'));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('tells someone without the approve grant to escalate, and offers no way to force it', async () => {
    vi.mocked(itemReceiptService.createItemReceipt).mockRejectedValue(overReceiptError());
    renderPage({ canApprove: false });
    const user = userEvent.setup();

    await clickSave(user);

    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent("You don't have permission to accept an over-delivery.");
    expect(screen.queryByRole('textbox', { name: 'Over-receipt reason' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Confirm & Post' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Close' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    // Nothing was saved, and closing leaves the message on the page.
    expect(await screen.findByRole('alert')).toHaveTextContent(/exceeds the ordered quantity/);
    expect(itemReceiptService.createItemReceipt).toHaveBeenCalledOnce();
    expect(navigateMock).not.toHaveBeenCalled();
  });

  it('closes the dialog and shows the error when the retry fails for a different reason', async () => {
    vi.mocked(itemReceiptService.createItemReceipt)
      .mockRejectedValueOnce(overReceiptError())
      .mockRejectedValueOnce(
        new AxiosError('conflict', 'ERR_BAD_REQUEST', undefined, undefined, {
          status: 409, data: { success: false, message: 'purchase order is not open for receiving' },
        } as AxiosResponse),
      );
    renderPage({ canApprove: true });
    const user = userEvent.setup();

    await clickSave(user);
    await user.type(await screen.findByRole('textbox', { name: 'Over-receipt reason' }), 'pallet');
    await user.click(screen.getByRole('button', { name: 'Confirm & Post' }));

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(await screen.findByRole('alert')).toHaveTextContent('purchase order is not open for receiving');
  });
});
