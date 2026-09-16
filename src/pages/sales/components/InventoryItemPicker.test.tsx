import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/inventoryService', () => ({
  inventoryService: { searchItems: vi.fn() },
}));

import { InventoryItemPicker } from './InventoryItemPicker';
import { inventoryService } from '@/services/inventoryService';
import type { InventoryItem } from '@/types/inventory';

const GOLD = { id: 'item-1', name: 'Calacatta Gold', sku: 'CG-01', unitPrice: 120 } as InventoryItem;
const WHITE = { id: 'item-2', name: 'Calacatta White', sku: 'CW-01', unitPrice: 95 } as InventoryItem;

function mockSearch(records: InventoryItem[]) {
  vi.mocked(inventoryService.searchItems).mockResolvedValue({ records, nextCursor: '', hasMore: false });
}

// Mirrors how the items tables host the picker: a controlled value inside the
// table's clipping overflow wrapper.
function Harness({ onPick = vi.fn(), onAddToInventory }: {
  onPick?: (item: InventoryItem) => void;
  onAddToInventory?: (name: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div data-testid="table-wrapper" className="overflow-hidden">
      <InventoryItemPicker
        value={value}
        onTextChange={setValue}
        onPick={(item) => { setValue(item.name); onPick(item); }}
        onAddToInventory={onAddToInventory}
      />
    </div>
  );
}

function renderPicker(props: Parameters<typeof Harness>[0] = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <Harness {...props} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('InventoryItemPicker', () => {
  it('renders results outside the table wrapper so they are never clipped', async () => {
    mockSearch([GOLD]);
    const user = userEvent.setup();
    renderPicker();

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Cala');

    expect(await screen.findByRole('option', { name: /Calacatta Gold/ })).toBeInTheDocument();
    expect(within(screen.getByTestId('table-wrapper')).queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('picks an inventory item on click', async () => {
    mockSearch([GOLD]);
    const onPick = vi.fn();
    const user = userEvent.setup();
    renderPicker({ onPick });

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Cala');
    await user.click(await screen.findByRole('option', { name: /Calacatta Gold/ }));

    expect(onPick).toHaveBeenCalledWith(GOLD);
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('warns and offers Add to Inventory when nothing matches', async () => {
    mockSearch([]);
    const onAddToInventory = vi.fn();
    const user = userEvent.setup();
    renderPicker({ onAddToInventory });

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Nero Marquina');

    expect(await screen.findByText(/“Nero Marquina” isn't in inventory/)).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Add “Nero Marquina” to Inventory' }));
    expect(onAddToInventory).toHaveBeenCalledWith('Nero Marquina');
  });

  it('only warns when the user cannot add inventory items', async () => {
    mockSearch([]);
    const user = userEvent.setup();
    renderPicker();

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Nero Marquina');

    expect(await screen.findByText(/Ask someone with inventory access/)).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /to Inventory/ })).not.toBeInTheDocument();
  });

  it('still offers Add to Inventory when results are only partial matches', async () => {
    mockSearch([GOLD, WHITE]);
    const user = userEvent.setup();
    renderPicker({ onAddToInventory: vi.fn() });

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Calacatta');

    expect(await screen.findByRole('option', { name: 'Add “Calacatta” to Inventory' })).toBeInTheDocument();
  });

  it('hides Add to Inventory once the typed name exactly matches an item', async () => {
    mockSearch([GOLD]);
    const user = userEvent.setup();
    renderPicker({ onAddToInventory: vi.fn() });

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'calacatta gold');

    expect(await screen.findByRole('option', { name: /Calacatta Gold/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /to Inventory/ })).not.toBeInTheDocument();
  });

  it('supports picking with the keyboard', async () => {
    mockSearch([GOLD, WHITE]);
    const onPick = vi.fn();
    const user = userEvent.setup();
    renderPicker({ onPick });

    const input = screen.getByRole('combobox', { name: 'Item Name' });
    await user.type(input, 'Cala');
    await screen.findByRole('option', { name: /Calacatta White/ });
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onPick).toHaveBeenCalledWith(WHITE);
  });

  it('closes on Escape', async () => {
    mockSearch([GOLD]);
    const user = userEvent.setup();
    renderPicker();

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Cala');
    await screen.findByRole('listbox');
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
