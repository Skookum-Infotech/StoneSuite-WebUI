import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useState } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/inventoryService', () => ({
  inventoryService: { searchItems: vi.fn(), searchKits: vi.fn() },
}));

import { InventoryItemPicker } from './InventoryItemPicker';
import { inventoryService } from '@/services/inventoryService';
import type { InventoryItem, InventoryKit } from '@/types/inventory';

const GOLD = { id: 'item-1', name: 'Calacatta Gold', sku: 'CG-01', unitPrice: 120 } as InventoryItem;
const WHITE = { id: 'item-2', name: 'Calacatta White', sku: 'CW-01', unitPrice: 95 } as InventoryItem;
const KITCHEN = {
  id: 'kit-1', name: 'Kitchen', description: '', isActive: true, itemCount: 4, createdAt: '', updatedAt: '',
} as InventoryKit;
const RETIRED_KIT = { ...KITCHEN, id: 'kit-2', name: 'Kitchen Old', isActive: false } as InventoryKit;

function mockSearch(records: InventoryItem[]) {
  vi.mocked(inventoryService.searchItems).mockResolvedValue({ records, nextCursor: '', hasMore: false });
}

function mockKits(records: InventoryKit[]) {
  vi.mocked(inventoryService.searchKits).mockResolvedValue({ records, nextCursor: '', hasMore: false });
}

// Mirrors how the items tables host the picker: a controlled value inside the
// table's clipping overflow wrapper.
function Harness({ onPick = vi.fn(), onAddToInventory, onPickKit, onAddKit }: {
  onPick?: (item: InventoryItem) => void;
  onAddToInventory?: (name: string) => void;
  onPickKit?: (kit: InventoryKit) => void;
  onAddKit?: (name: string) => void;
}) {
  const [value, setValue] = useState('');
  return (
    <div data-testid="table-wrapper" className="overflow-hidden">
      <InventoryItemPicker
        value={value}
        onTextChange={setValue}
        onPick={(item) => { setValue(item.name); onPick(item); }}
        onAddToInventory={onAddToInventory}
        onPickKit={onPickKit}
        onAddKit={onAddKit}
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

describe('InventoryItemPicker — kits', () => {
  it('never asks for kits when kits are not enabled (editing an existing line)', async () => {
    mockSearch([GOLD]);
    const user = userEvent.setup();
    renderPicker();

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Kit');
    await screen.findByRole('option', { name: /Calacatta Gold/ });

    expect(inventoryService.searchKits).not.toHaveBeenCalled();
  });

  it('lists matching kits after the items, marked KIT with their item count', async () => {
    mockSearch([GOLD]);
    mockKits([KITCHEN]);
    const user = userEvent.setup();
    renderPicker({ onPickKit: vi.fn() });

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Kit');

    const options = await screen.findAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual([
      expect.stringContaining('Calacatta Gold'),
      expect.stringContaining('Kitchen'),
    ]);
    expect(options[1]).toHaveTextContent('KIT');
    expect(options[1]).toHaveTextContent('4 items');
  });

  it('picks a kit on click, handing over the kit and not an item', async () => {
    mockSearch([]);
    mockKits([KITCHEN]);
    const onPick = vi.fn();
    const onPickKit = vi.fn();
    const user = userEvent.setup();
    renderPicker({ onPick, onPickKit });

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Kitch');
    await user.click(await screen.findByRole('option', { name: /Kitchen/ }));

    expect(onPickKit).toHaveBeenCalledWith(KITCHEN);
    expect(onPick).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('leaves out an inactive kit', async () => {
    mockSearch([]);
    mockKits([KITCHEN, RETIRED_KIT]);
    const user = userEvent.setup();
    renderPicker({ onPickKit: vi.fn() });

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Kitch');

    await screen.findByRole('option', { name: /^Kitchen KIT/ });
    expect(screen.queryByRole('option', { name: /Kitchen Old/ })).not.toBeInTheDocument();
  });

  it('offers Add as a Kit for a name that is no kit, next to Add to Inventory', async () => {
    mockSearch([]);
    mockKits([]);
    const onAddKit = vi.fn();
    const user = userEvent.setup();
    renderPicker({ onPickKit: vi.fn(), onAddKit, onAddToInventory: vi.fn() });

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Bathroom');

    expect(await screen.findByRole('option', { name: 'Add “Bathroom” to Inventory' })).toBeInTheDocument();
    await user.click(screen.getByRole('option', { name: 'Add “Bathroom” as a Kit' }));
    expect(onAddKit).toHaveBeenCalledWith('Bathroom');
  });

  it('hides Add as a Kit once the name is exactly an existing kit', async () => {
    mockSearch([]);
    mockKits([KITCHEN]);
    const user = userEvent.setup();
    renderPicker({ onPickKit: vi.fn(), onAddKit: vi.fn() });

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'kitchen');

    await screen.findByRole('option', { name: /^Kitchen KIT/ });
    expect(screen.queryByRole('option', { name: /as a Kit/ })).not.toBeInTheDocument();
  });

  it('does not offer Add as a Kit without the handler (no permission to create)', async () => {
    mockSearch([]);
    mockKits([]);
    const user = userEvent.setup();
    renderPicker({ onPickKit: vi.fn() });

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Bathroom');

    await screen.findByText(/isn't in inventory/);
    expect(screen.queryByRole('option', { name: /as a Kit/ })).not.toBeInTheDocument();
  });

  it('reaches a kit with the keyboard', async () => {
    mockSearch([GOLD]);
    mockKits([KITCHEN]);
    const onPickKit = vi.fn();
    const user = userEvent.setup();
    renderPicker({ onPickKit });

    await user.type(screen.getByRole('combobox', { name: 'Item Name' }), 'Kit');
    await screen.findByRole('option', { name: /^Kitchen KIT/ });
    await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

    expect(onPickKit).toHaveBeenCalledWith(KITCHEN);
  });
});
