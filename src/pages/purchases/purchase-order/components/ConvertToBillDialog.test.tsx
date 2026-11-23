import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/purchaseOrderService', () => ({ purchaseOrderService: { convertToBill: vi.fn() } }));

import { ConvertToBillDialog } from './ConvertToBillDialog';
import { purchaseOrderService } from '@/services/purchaseOrderService';
import type { BillableLine } from '@/lib/purchaseOrderForm';
import type { VendorBill } from '@/types/vendorBill';

const lines: BillableLine[] = [
  { id: 'l1', lineNumber: 1, itemName: 'Slab', ordered: 10, toBill: 4 },
  { id: 'l3', lineNumber: 3, itemName: '', ordered: 8, toBill: 8 },
];

function renderDialog() {
  const onClose = vi.fn();
  const onConverted = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ConvertToBillDialog
        purchaseOrder={{ id: 'po-1', number: 'PO-000001', vendorName: 'Nero Marble Co' }}
        lines={lines}
        onClose={onClose}
        onConverted={onConverted}
      />
    </QueryClientProvider>,
  );
  return { onClose, onConverted };
}

beforeEach(() => vi.clearAllMocks());

describe('ConvertToBillDialog', () => {
  it('lists each line with how much of it the bill covers', () => {
    renderDialog();

    expect(screen.getByRole('dialog')).toHaveAccessibleName('Create a vendor bill?');
    const list = screen.getByRole('list', { name: 'Lines on the new bill' });
    expect(list).toHaveTextContent('1. Slab');
    expect(list).toHaveTextContent('4 of 10 ordered');
    expect(list).toHaveTextContent('3. Item'); // a nameless line still reads as a line
    expect(list).toHaveTextContent('8 of 8 ordered');
    expect(screen.getByText('Nero Marble Co')).toBeInTheDocument();
  });

  it('creates the bill on confirm and hands it back', async () => {
    const bill = { id: 'vb-1' } as unknown as VendorBill;
    vi.mocked(purchaseOrderService.convertToBill).mockResolvedValue(bill);
    const { onConverted } = renderDialog();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Create vendor bill' }));

    await waitFor(() => expect(purchaseOrderService.convertToBill).toHaveBeenCalledWith('po-1'));
    await waitFor(() => expect(onConverted).toHaveBeenCalledOnce());
    expect(onConverted.mock.calls[0][0]).toBe(bill);
  });

  it('shows the backend message when nothing can be billed, and stays open', async () => {
    vi.mocked(purchaseOrderService.convertToBill).mockRejectedValue(
      new Error('Everything received on this purchase order has already been billed.'),
    );
    const { onConverted, onClose } = renderDialog();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Create vendor bill' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('already been billed');
    expect(onConverted).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes without creating anything on Cancel', async () => {
    const { onClose } = renderDialog();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalledOnce();
    expect(purchaseOrderService.convertToBill).not.toHaveBeenCalled();
  });
});
