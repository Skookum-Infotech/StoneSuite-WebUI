import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/purchaseOrderService', () => ({
  purchaseOrderService: { getPurchaseOrder: vi.fn() },
}));
vi.mock('@/services/itemReceiptService', () => ({
  itemReceiptService: { forPurchaseOrder: vi.fn() },
}));

import { PurchaseOrderReceivingProgress } from './PurchaseOrderReceivingProgress';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import { itemReceiptService } from '@/services/itemReceiptService';
import type { PurchaseOrder, PurchaseOrderLine } from '@/types/purchaseOrder';
import type { ItemReceipt } from '@/types/itemReceipt';

type RowOrder = Parameters<typeof PurchaseOrderReceivingProgress>[0]['order'];

const ROW: RowOrder = { id: 'po-1', purchaseOrderNumber: 'PO-1001', statusCode: 'PART', receivedPercent: 50 };
const TRIGGER = 'Receiving progress for PO-1001: 50%. Show details';

function line(id: string, name: string, quantity: number, qtyReceived: number, qtyBilled = 0): PurchaseOrderLine {
  return {
    id, lineNumber: 1, sku: '', itemName: name, description: '', unitCode: '',
    quantity, qtyReceived, qtyBilled, unitPrice: 1, discountPercent: 0, taxPercent: 0,
    lineSubtotal: 0, lineDiscount: 0, lineTax: 0, lineTotal: 0,
  };
}

const DETAIL = {
  purchaseOrderNumber: 'PO-1001',
  statusCode: 'PART',
  vendor: { id: 'v-1', name: 'Marble Supply Co' },
  expectedDate: '2099-01-01',
  items: [line('a', 'Slab A', 10, 10, 10), line('b', 'Slab B', 10, 0)],
} as PurchaseOrder;

const RECEIPT = { receiptDate: '2026-10-10', postedAt: '2026-10-10T09:00:00Z' } as ItemReceipt;

function renderCell(order: RowOrder = ROW) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PurchaseOrderReceivingProgress order={order} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue(DETAIL);
  vi.mocked(itemReceiptService.forPurchaseOrder).mockResolvedValue([RECEIPT]);
});

describe('PurchaseOrderReceivingProgress cell', () => {
  it.each(['DRFT', 'PAPV', 'APPV', 'CANC'])('shows a dash for a %s order, which cannot receive yet', (statusCode) => {
    renderCell({ ...ROW, statusCode: statusCode as RowOrder['statusCode'] });
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('shows a dash when the server sent no percent', () => {
    renderCell({ ...ROW, receivedPercent: undefined });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('shows the bar and percent for an order that is receiving', () => {
    renderCell();
    expect(screen.getByRole('button', { name: TRIGGER })).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
  });

  it('does not load anything until the bar is clicked', () => {
    renderCell();
    expect(purchaseOrderService.getPurchaseOrder).not.toHaveBeenCalled();
    expect(itemReceiptService.forPurchaseOrder).not.toHaveBeenCalled();
  });
});

describe('PurchaseOrderReceivingProgress card', () => {
  it('opens a card with the order summary and a line breakdown', async () => {
    const user = userEvent.setup();
    renderCell();

    await user.click(screen.getByRole('button', { name: TRIGGER }));

    expect(await screen.findByText('PO-1001 receiving')).toBeInTheDocument();
    expect(screen.getByText('Marble Supply Co')).toBeInTheDocument();
    expect(screen.getByText('1 of 2 lines fully received')).toBeInTheDocument();
    expect(screen.getByText(/^1 receipt · last received /)).toBeInTheDocument();
    expect(screen.getByText('Slab A')).toBeInTheDocument();
    expect(screen.getByText('Slab B')).toBeInTheDocument();
    expect(purchaseOrderService.getPurchaseOrder).toHaveBeenCalledWith('po-1');
    expect(itemReceiptService.forPurchaseOrder).toHaveBeenCalledWith('po-1');
  });

  it('shows the billed bar next to lines received', async () => {
    const user = userEvent.setup();
    renderCell();

    await user.click(screen.getByRole('button', { name: TRIGGER }));

    expect(await screen.findByRole('progressbar', { name: 'Lines received for PO-1001 receiving' })).toHaveAttribute('aria-valuetext', '1 of 2');
    expect(screen.getByRole('progressbar', { name: 'Billed for PO-1001 receiving' })).toHaveAttribute('aria-valuenow', '50');
  });

  it('flags an order whose goods are late', async () => {
    const user = userEvent.setup();
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockResolvedValue({ ...DETAIL, expectedDate: '2020-01-01' });
    renderCell();

    await user.click(screen.getByRole('button', { name: TRIGGER }));

    expect(await screen.findByText(/^Overdue · expected /)).toBeInTheDocument();
  });

  it('still shows the card, minus the receipts line, when receipts fail to load', async () => {
    const user = userEvent.setup();
    vi.mocked(itemReceiptService.forPurchaseOrder).mockRejectedValue(new Error('boom'));
    renderCell();

    await user.click(screen.getByRole('button', { name: TRIGGER }));

    expect(await screen.findByText('1 of 2 lines fully received')).toBeInTheDocument();
    expect(screen.queryByText(/receipt/i)).not.toBeInTheDocument();
  });

  it('shows an error when the order itself fails to load', async () => {
    const user = userEvent.setup();
    vi.mocked(purchaseOrderService.getPurchaseOrder).mockRejectedValue(new Error('Order not found.'));
    renderCell();

    await user.click(screen.getByRole('button', { name: TRIGGER }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Order not found.');
  });
});
