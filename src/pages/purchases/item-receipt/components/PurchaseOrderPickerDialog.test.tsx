import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/purchaseOrderService', () => ({ purchaseOrderService: { searchPurchaseOrders: vi.fn() } }));

import { PurchaseOrderPickerDialog } from './PurchaseOrderPickerDialog';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import type { PurchaseOrderPage, PurchaseOrderSummary } from '@/types/purchaseOrder';

// The picker is the entry point for "New Receipt": it must only offer orders
// that can actually be received against, and point at PO creation when the
// order being looked for isn't there.

const RECEIVABLE_FILTER = { field: 'status_code', op: 'in', value: ['SENT', 'PART'] };
// Covers the 300ms search debounce plus the query round trip.
const SETTLE_MS = 2000;

const po = (id: string, number: string, statusCode: string, status: string) =>
  ({ id, purchaseOrderNumber: number, statusCode, status, vendor: { name: 'Acme Stone' } }) as unknown as PurchaseOrderSummary;

function page(records: PurchaseOrderSummary[]): PurchaseOrderPage {
  return { records, nextCursor: '', hasMore: false, scope: 'all' };
}

function renderPicker(props: { onCreatePurchaseOrder?: () => void } = {}) {
  const onClose = vi.fn();
  const onSelect = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <PurchaseOrderPickerDialog onClose={onClose} onSelect={onSelect} {...props} />
    </QueryClientProvider>,
  );
  return { onClose, onSelect };
}

beforeEach(() => vi.clearAllMocks());

describe('PurchaseOrderPickerDialog', () => {
  it('asks the server for receivable orders only', async () => {
    vi.mocked(purchaseOrderService.searchPurchaseOrders).mockResolvedValue(page([po('po-1', 'PO-0001', 'SENT', 'Sent')]));
    renderPicker();

    await screen.findByRole('button', { name: 'Receive against PO-0001' });
    expect(purchaseOrderService.searchPurchaseOrders).toHaveBeenCalledWith(
      expect.objectContaining({ filters: [RECEIVABLE_FILTER], search: undefined }),
    );
  });

  it('keeps the receivable filter while searching', async () => {
    vi.mocked(purchaseOrderService.searchPurchaseOrders).mockResolvedValue(page([po('po-1', 'PO-0001', 'SENT', 'Sent')]));
    renderPicker();
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: 'Search purchase orders' }), 'acme');

    await waitFor(
      () => expect(purchaseOrderService.searchPurchaseOrders).toHaveBeenCalledWith(
        expect.objectContaining({ filters: [RECEIVABLE_FILTER], search: 'acme' }),
      ),
      { timeout: SETTLE_MS },
    );
  });

  it('lists each order as a selectable row', async () => {
    vi.mocked(purchaseOrderService.searchPurchaseOrders).mockResolvedValue(
      page([po('po-1', 'PO-0001', 'SENT', 'Sent'), po('po-2', 'PO-0002', 'PART', 'Partially Received')]),
    );
    const { onSelect } = renderPicker();
    const user = userEvent.setup();

    const row = await screen.findByRole('button', { name: 'Receive against PO-0002' });
    expect(row).toBeEnabled();
    await user.click(row);

    expect(onSelect).toHaveBeenCalledWith('po-2');
  });

  it('offers to create a purchase order when a search finds nothing', async () => {
    vi.mocked(purchaseOrderService.searchPurchaseOrders).mockResolvedValue(page([]));
    const onCreatePurchaseOrder = vi.fn();
    renderPicker({ onCreatePurchaseOrder });
    const user = userEvent.setup();

    await user.type(screen.getByRole('textbox', { name: 'Search purchase orders' }), 'PO-9999');

    expect(await screen.findByText('No open purchase orders match "PO-9999".', {}, { timeout: SETTLE_MS })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create purchase order' }));
    expect(onCreatePurchaseOrder).toHaveBeenCalledTimes(1);
  });

  it('also offers it when no order is open for receiving at all', async () => {
    vi.mocked(purchaseOrderService.searchPurchaseOrders).mockResolvedValue(page([]));
    renderPicker({ onCreatePurchaseOrder: vi.fn() });

    expect(await screen.findByText('No purchase orders are open for receiving.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create purchase order' })).toBeInTheDocument();
  });

  it('hides the create option when the caller cannot create purchase orders', async () => {
    vi.mocked(purchaseOrderService.searchPurchaseOrders).mockResolvedValue(page([]));
    renderPicker();

    await screen.findByText('No purchase orders are open for receiving.');
    expect(screen.queryByRole('button', { name: 'Create purchase order' })).not.toBeInTheDocument();
  });

  it('does not offer it while there are matching orders', async () => {
    vi.mocked(purchaseOrderService.searchPurchaseOrders).mockResolvedValue(page([po('po-1', 'PO-0001', 'SENT', 'Sent')]));
    renderPicker({ onCreatePurchaseOrder: vi.fn() });

    await screen.findByRole('button', { name: 'Receive against PO-0001' });
    expect(screen.queryByRole('button', { name: 'Create purchase order' })).not.toBeInTheDocument();
  });
});
