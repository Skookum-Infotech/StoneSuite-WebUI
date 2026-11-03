import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const unit = (id: number, name: string, code: string, category: string) => ({ id, name, code, isActive: true, isSystem: true, extra: { category } });
const { lookupsRef } = vi.hoisted(() => ({ lookupsRef: { units: [] as unknown[] } }));

vi.mock('@/hooks/useInventoryLookups', () => ({ useInventoryLookups: () => ({ lookups: { units: lookupsRef.units } }) }));
vi.mock('@/services/lookupService', () => ({ lookupService: { getCrmLookups: vi.fn().mockResolvedValue({}) } }));

import { ItemFormBody } from './ItemFormBody';

const EACH = unit(1, 'Each', 'EA', 'count');
const SQFT = unit(6, 'Square Foot', 'SQFT', 'area');

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

beforeEach(() => { lookupsRef.units = [EACH, SQFT]; });

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
    renderBody({ unit_id: '6', tracking: 'serialized', track_stock: false });

    const box = screen.getByRole('checkbox', { name: 'Track stock' });
    expect(box).toBeChecked();
    expect(box).toBeDisabled();
    expect(screen.getByText(/slab items are always tracked/i)).toBeInTheDocument();
  });
});

describe('ItemFormBody — a square unit makes the item a slab', () => {
  it('shows a slab item, with no Tracking choice to get wrong', () => {
    renderBody({ unit_id: '6', tracking: 'quantity' });

    expect(screen.queryByRole('combobox', { name: 'Tracking' })).not.toBeInTheDocument();
    expect(screen.getByTestId('item-tracking')).toHaveTextContent(/slab/i);
  });

  it('shows a count item as counted by quantity', () => {
    renderBody({ unit_id: '1', tracking: 'quantity' });

    expect(screen.getByTestId('item-tracking')).toHaveTextContent(/quantity/i);
  });

  it('treats a saved item with a square unit as a slab even if it was saved as a count', () => {
    renderBody({ unit_id: '6', tracking: 'quantity', track_stock: false });

    expect(screen.getByRole('checkbox', { name: 'Track stock' })).toBeDisabled();
  });

  it('sets tracking from the unit the moment one is picked', async () => {
    const set = renderBody({ unit_id: '1', tracking: 'quantity' });
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: 'Unit' }));
    await user.click(screen.getByRole('option', { name: /Square Foot/ }));

    expect(set).toHaveBeenCalledWith('unit_id', '6');
    expect(set).toHaveBeenCalledWith('tracking', 'serialized');
  });

  it('puts tracking back to quantity when a count unit is picked', async () => {
    const set = renderBody({ unit_id: '6', tracking: 'serialized' });
    const user = userEvent.setup();

    await user.click(screen.getByRole('combobox', { name: 'Unit' }));
    await user.click(screen.getByRole('option', { name: /Each/ }));

    expect(set).toHaveBeenCalledWith('tracking', 'quantity');
  });
});
