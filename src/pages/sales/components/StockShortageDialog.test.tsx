import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StockShortageDialog } from './StockShortageDialog';
import type { StockShortage } from '@/types/salesOrder';

const SLAB: StockShortage = {
  itemId: 'item-1', sku: 'GRAN-001', name: 'Absolute Black', unitCode: 'SQFT', requested: 60, available: 45.208, short: 14.792,
};
const SINK: StockShortage = {
  itemId: 'item-2', sku: 'SINK-9', name: 'Undermount Sink', unitCode: 'EA', requested: 4, available: 1, short: 3,
};

describe('StockShortageDialog', () => {
  it('says the order was not saved and lists every short item with the figures', () => {
    render(<StockShortageDialog shortages={[SLAB, SINK]} onClose={vi.fn()} />);

    expect(screen.getByRole('alertdialog', { name: 'Not enough stock' })).toBeInTheDocument();
    expect(screen.getByText(/this order was not saved/i)).toBeInTheDocument();
    const slab = screen.getByText('Absolute Black').closest('tr') as HTMLElement;
    expect(within(slab).getByText('GRAN-001')).toBeInTheDocument();
    expect(within(slab).getByText('60 sq ft')).toBeInTheDocument();
    expect(within(slab).getByText('45.208 sq ft')).toBeInTheDocument();
    expect(within(slab).getByText('14.792 sq ft')).toBeInTheDocument();
    const sink = screen.getByText('Undermount Sink').closest('tr') as HTMLElement;
    expect(within(sink).getByText('4 each')).toBeInTheDocument();
    expect(within(sink).getByText('1 each')).toBeInTheDocument();
    expect(within(sink).getByText('3 each')).toBeInTheDocument();
  });

  it('closes from the Close button, the backdrop and Escape', async () => {
    const onClose = vi.fn();
    render(<StockShortageDialog shortages={[SLAB]} onClose={onClose} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('alertdialog'));
    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('starts a requisition for the shortfall when it is offered', async () => {
    const onRestock = vi.fn();
    render(<StockShortageDialog shortages={[SLAB]} onClose={vi.fn()} onRestock={onRestock} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Create requisition for the shortfall' }));

    expect(onRestock).toHaveBeenCalledTimes(1);
  });

  it('offers no requisition button when the user cannot create one', () => {
    render(<StockShortageDialog shortages={[SLAB]} onClose={vi.fn()} />);

    expect(screen.queryByRole('button', { name: /create requisition/i })).not.toBeInTheDocument();
  });
});
