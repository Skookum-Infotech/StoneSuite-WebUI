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
