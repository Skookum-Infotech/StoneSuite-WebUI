import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/services/inventoryStockService', () => ({
  inventoryStockService: { forItem: vi.fn(), setReorderPoint: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { ItemStockTab } from './ItemStockTab';
import { inventoryStockService } from '@/services/inventoryStockService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { InventoryItem, StockRow } from '@/types/inventory';

const ITEM = {
  id: 'item-1', sku: 'ADH-01', name: 'Adhesive', tracking: 'quantity',
} as InventoryItem;

function row(over: Partial<StockRow> = {}): StockRow {
  return {
    itemId: 'item-1', sku: 'ADH-01', itemName: 'Adhesive', tracking: 'quantity', unitCode: 'EA',
    warehouseId: 1, warehouseName: 'Yard A', onHand: 10, allocated: 3, available: 7, reorderPoint: 0,
    ...over,
  };
}

function mockPermissions(allowed: string[]) {
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => allowed.includes(`${resource}:${action}`),
  } as ReturnType<typeof useUserPermissions>);
}

function renderTab(item: InventoryItem = ITEM) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <ItemStockTab item={item} />
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPermissions(['inventory_item:read', 'inventory_item:update']);
});

describe('ItemStockTab', () => {
  it('shows a row per location with on hand, allocated and available', async () => {
    vi.mocked(inventoryStockService.forItem).mockResolvedValue([
      row(),
      row({ warehouseId: 2, warehouseName: 'Yard B', onHand: 0, allocated: 0, available: 0 }),
    ]);
    renderTab();

    const yardA = (await screen.findByText('Yard A')).closest('tr') as HTMLElement;
    expect(within(yardA).getByText('10')).toBeInTheDocument();
    expect(within(yardA).getByText('3')).toBeInTheDocument();
    expect(within(yardA).getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Yard B')).toBeInTheDocument();
  });

  it('says so, without naming a location, when the item is held nowhere', async () => {
    vi.mocked(inventoryStockService.forItem).mockResolvedValue([]);
    renderTab();
    expect(await screen.findByText(/hasn't been received into any location yet/)).toBeInTheDocument();
  });

  it('flags a location at or below its reorder point', async () => {
    vi.mocked(inventoryStockService.forItem).mockResolvedValue([
      row({ onHand: 4, available: 4, allocated: 0, reorderPoint: 5 }),
      row({ warehouseId: 2, warehouseName: 'Yard B', reorderPoint: 5 }),
    ]);
    renderTab();

    const low = (await screen.findByText('Yard A')).closest('tr') as HTMLElement;
    const fine = screen.getByText('Yard B').closest('tr') as HTMLElement;
    expect(within(low).getByText('Low stock')).toBeInTheDocument();
    expect(within(fine).queryByText('Low stock')).not.toBeInTheDocument();
  });

  it('does not flag an item with no reorder point set', async () => {
    vi.mocked(inventoryStockService.forItem).mockResolvedValue([row({ onHand: 0, available: 0, reorderPoint: 0 })]);
    renderTab();
    await screen.findByText('Yard A');
    expect(screen.queryByText('Low stock')).not.toBeInTheDocument();
  });

  it('hides the reorder point controls without inventory_item:update', async () => {
    mockPermissions(['inventory_item:read']);
    vi.mocked(inventoryStockService.forItem).mockResolvedValue([row({ reorderPoint: 5 })]);
    renderTab();

    await screen.findByText('Yard A');
    expect(screen.queryByRole('spinbutton', { name: 'Reorder point at Yard A' })).not.toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('saves a reorder point for the location', async () => {
    const user = userEvent.setup();
    vi.mocked(inventoryStockService.forItem).mockResolvedValue([row()]);
    vi.mocked(inventoryStockService.setReorderPoint).mockResolvedValue(row({ reorderPoint: 5 }));
    renderTab();

    const input = await screen.findByRole('spinbutton', { name: 'Reorder point at Yard A' });
    await user.clear(input);
    await user.type(input, '5');
    await user.click(screen.getByRole('button', { name: 'Save reorder point at Yard A' }));

    await waitFor(() => expect(inventoryStockService.setReorderPoint).toHaveBeenCalledWith({
      itemId: 'item-1', warehouseId: 1, reorderPoint: 5,
    }));
  });

  it('refuses a negative reorder point inline and sends nothing', async () => {
    vi.mocked(inventoryStockService.forItem).mockResolvedValue([row()]);
    renderTab();

    const input = await screen.findByRole('spinbutton', { name: 'Reorder point at Yard A' });
    fireEvent.change(input, { target: { value: '-2' } });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save reorder point at Yard A' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/can't be negative/);
    expect(inventoryStockService.setReorderPoint).not.toHaveBeenCalled();
  });
});
