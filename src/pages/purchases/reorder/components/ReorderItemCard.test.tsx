import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReorderItem } from '@/types/replenishment';

vi.mock('react-router-dom', async () => ({
  Link: (await import('@/test/routerLinkStub')).RouterLinkStub,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock('@/services/replenishmentService', () => ({ replenishmentService: { draft: vi.fn() } }));
// The real picker searches vendors over the network; this one just picks "Vendor A"/"Vendor B"
// so the card's own split logic is what's under test.
vi.mock('@/pages/purchases/purchase-order/components/VendorPicker', () => ({
  VendorPicker: ({ value, onChange }: {
    value: { id: string; name: string } | null;
    onChange: (v: { id: string; name: string } | null) => void;
  }) => (
    <div>
      <span data-testid="picked">{value?.name ?? 'none'}</span>
      <button type="button" onClick={() => onChange({ id: 'vendor-a', name: 'Vendor A' })}>Pick A</button>
      <button type="button" onClick={() => onChange({ id: 'vendor-b', name: 'Vendor B' })}>Pick B</button>
    </div>
  ),
}));

import { ReorderItemCard } from './ReorderItemCard';
import { replenishmentService } from '@/services/replenishmentService';
import { toast } from 'sonner';

const ITEM: ReorderItem = {
  inventoryItemId: 'item-1', sku: 'GRAN-001', name: 'Absolute Black', tracking: 'serialized', unit: 'slabs',
  usage: [{ month: '2026-08', used: 50 }, { month: '2026-09', used: 48 }, { month: '2026-10', used: 50 }],
  monthlyRequirement: 50, onHand: 10, onOrder: 0, needed: 40,
};

function renderCard(item: ReorderItem = ITEM) {
  const onCreated = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ReorderItemCard item={item} onCreated={onCreated} />
    </QueryClientProvider>,
  );
  return onCreated;
}

beforeEach(() => vi.clearAllMocks());

describe('ReorderItemCard — what is shown', () => {
  it('shows the usage, the stock figures and what is needed', () => {
    renderCard();

    expect(screen.getByText('Absolute Black')).toBeInTheDocument();
    expect(screen.getByText(/Used 50, 48, and 50 in Aug, Sep, Oct/)).toBeInTheDocument();
    expect(screen.getByText('Monthly requirement').nextElementSibling).toHaveTextContent('50');
    expect(screen.getByText('On hand').nextElementSibling).toHaveTextContent('10');
    expect(screen.getByText('On open POs').nextElementSibling).toHaveTextContent('0');
    expect(screen.getByText('Needed').nextElementSibling).toHaveTextContent('40');
  });

  it('links the open purchase orders already counted', () => {
    renderCard({ ...ITEM, onOrder: 8, needed: 32, openOrders: [{ id: 'po-1', number: 'PORD-000123', status: 'Sent', remaining: 8 }] });

    const link = screen.getByRole('link', { name: 'Open purchase order PORD-000123' });
    expect(link).toHaveAttribute('href', '/purchases/purchase_order/po-1');
    expect(screen.getByText(/8 slabs left, Sent/)).toBeInTheDocument();
  });

  it('starts with one vendor line holding the whole need', () => {
    renderCard();

    expect(screen.getByRole('spinbutton', { name: 'Quantity to order from this vendor' })).toHaveValue(40);
    expect(screen.getByText('40 of 40 planned')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create PO' })).toBeInTheDocument();
  });

  it('asks for whole slabs, but any fraction of a bulk unit', () => {
    renderCard();
    expect(screen.getByRole('spinbutton', { name: 'Quantity to order from this vendor' })).toHaveAttribute('step', '1');
  });
});

describe('ReorderItemCard — creating POs', () => {
  it('cannot create until a vendor is chosen', async () => {
    renderCard();
    expect(screen.getByRole('button', { name: 'Create PO' })).toBeDisabled();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Pick A' }));

    expect(screen.getByRole('button', { name: 'Create PO' })).toBeEnabled();
  });

  it('creates one PO for the chosen vendor and reports it', async () => {
    vi.mocked(replenishmentService.draft).mockResolvedValue([{ vendorId: 'vendor-a', purchaseOrderId: 'po-9' }]);
    const onCreated = renderCard();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Pick A' }));
    await user.click(screen.getByRole('button', { name: 'Create PO' }));

    await waitFor(() => expect(replenishmentService.draft).toHaveBeenCalledWith({
      inventoryItemId: 'item-1', vendors: [{ vendorId: 'vendor-a', qty: 40 }],
    }));
    await waitFor(() => expect(onCreated).toHaveBeenCalledWith(expect.objectContaining({
      itemName: 'Absolute Black', orders: [{ id: 'po-9', vendorName: 'Vendor A' }],
    })));
    expect(toast.success).toHaveBeenCalledWith('Draft purchase order created.');
  });

  it('splits the quantity across two vendors and creates one PO each', async () => {
    vi.mocked(replenishmentService.draft).mockResolvedValue([
      { vendorId: 'vendor-a', purchaseOrderId: 'po-1' }, { vendorId: 'vendor-b', purchaseOrderId: 'po-2' },
    ]);
    const onCreated = renderCard();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add vendor' }));
    const [first, second] = screen.getAllByRole('spinbutton', { name: 'Quantity to order from this vendor' });
    await user.clear(first);
    await user.type(first, '25');
    await user.type(second, '15');
    const [pickA, pickB] = [screen.getAllByRole('button', { name: 'Pick A' })[0], screen.getAllByRole('button', { name: 'Pick B' })[1]];
    await user.click(pickA);
    await user.click(pickB);

    expect(screen.getByText('40 of 40 planned')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Create 2 draft POs' }));

    await waitFor(() => expect(replenishmentService.draft).toHaveBeenCalledWith({
      inventoryItemId: 'item-1',
      vendors: [{ vendorId: 'vendor-a', qty: 25 }, { vendorId: 'vendor-b', qty: 15 }],
    }));
    await waitFor(() => expect(onCreated).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('2 draft purchase orders created.');
  });

  it('says so when the plan is short of the need, and still lets you create it', async () => {
    renderCard();
    const user = userEvent.setup();

    const qty = screen.getByRole('spinbutton', { name: 'Quantity to order from this vendor' });
    await user.clear(qty);
    await user.type(qty, '25');
    await user.click(screen.getByRole('button', { name: 'Pick A' }));

    expect(screen.getByText('25 of 40 planned · 15 still short')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create PO' })).toBeEnabled();
  });

  it('refuses the same vendor twice', async () => {
    renderCard();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add vendor' }));
    const picks = screen.getAllByRole('button', { name: 'Pick A' });
    await user.click(picks[0]);
    await user.click(picks[1]);
    await user.type(screen.getAllByRole('spinbutton', { name: 'Quantity to order from this vendor' })[1], '5');

    expect(screen.getByRole('button', { name: 'Create 2 draft POs' })).toBeDisabled();
  });

  it('removes a vendor line, but never the last one', async () => {
    renderCard();
    const user = userEvent.setup();

    expect(screen.getByRole('button', { name: 'Remove this vendor' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Add vendor' }));
    await user.click(screen.getAllByRole('button', { name: 'Remove this vendor' })[0]);

    expect(screen.getAllByRole('spinbutton', { name: 'Quantity to order from this vendor' })).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Remove this vendor' })).toBeDisabled();
  });

  it('shows the server\'s message when creating fails', async () => {
    vi.mocked(replenishmentService.draft).mockRejectedValue(new Error('boom'));
    const onCreated = renderCard();
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Pick A' }));
    await user.click(screen.getByRole('button', { name: 'Create PO' }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(onCreated).not.toHaveBeenCalled();
  });
});
