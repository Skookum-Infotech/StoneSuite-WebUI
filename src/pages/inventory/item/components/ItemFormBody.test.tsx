import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/hooks/useInventoryLookups', () => ({ useInventoryLookups: () => ({ lookups: undefined }) }));
vi.mock('@/services/lookupService', () => ({ lookupService: { getCrmLookups: vi.fn().mockResolvedValue({}) } }));

import { ItemFormBody } from './ItemFormBody';

function renderBody(data: Record<string, unknown>) {
  const set = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ItemFormBody data={data} set={set} />
    </QueryClientProvider>,
  );
  return set;
}

describe('ItemFormBody — prices', () => {
  it('asks for a purchasing and a selling unit price, both required', () => {
    renderBody({ purchase_unit_price: '', unit_price: '' });

    const purchasing = screen.getByRole('spinbutton', { name: 'Purchasing Unit Price' });
    const selling = screen.getByRole('spinbutton', { name: 'Selling Unit Price' });
    expect(purchasing).toBeRequired();
    expect(selling).toBeRequired();
    expect(purchasing).toHaveAttribute('step', '0.01');
    expect(selling).toHaveAttribute('step', '0.01');
    expect(screen.queryByRole('spinbutton', { name: 'Unit Price' })).not.toBeInTheDocument();
  });

  it('writes each price to its own field', async () => {
    const set = renderBody({ purchase_unit_price: '', unit_price: '' });
    const user = userEvent.setup();

    await user.type(screen.getByRole('spinbutton', { name: 'Purchasing Unit Price' }), '7');
    await user.type(screen.getByRole('spinbutton', { name: 'Selling Unit Price' }), '9');

    expect(set).toHaveBeenCalledWith('purchase_unit_price', '7');
    expect(set).toHaveBeenCalledWith('unit_price', '9');
  });

  it('shows the values an item was saved with', () => {
    renderBody({ purchase_unit_price: '80.5', unit_price: '120' });

    expect(screen.getByRole('spinbutton', { name: 'Purchasing Unit Price' })).toHaveValue(80.5);
    expect(screen.getByRole('spinbutton', { name: 'Selling Unit Price' })).toHaveValue(120);
  });
});

describe('ItemFormBody — Track stock', () => {
  it('is on by default and can be switched off for a service item', async () => {
    const set = renderBody({ tracking: 'quantity', track_stock: true });

    const box = screen.getByRole('checkbox', { name: 'Track stock' });
    expect(box).toBeChecked();
    await userEvent.setup().click(box);

    expect(set).toHaveBeenCalledWith('track_stock', false);
  });

  it('shows an item that has been switched off as off', () => {
    renderBody({ tracking: 'quantity', track_stock: false });

    expect(screen.getByRole('checkbox', { name: 'Track stock' })).not.toBeChecked();
  });

  it('is always on, and locked, for a slab item', () => {
    renderBody({ tracking: 'serialized', track_stock: false });

    const box = screen.getByRole('checkbox', { name: 'Track stock' });
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    expect(screen.getByText(/slab items are always tracked/i)).toBeInTheDocument();
  });
});
