import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/services/inventoryService', () => ({ inventoryService: { searchItems: vi.fn() } }));
vi.mock('@/services/inventoryStockService', () => ({
  inventoryStockService: { totals: vi.fn(), forItem: vi.fn(), setReorderPoint: vi.fn() },
}));
vi.mock('@/hooks/useUserPermissions', () => ({ useUserPermissions: vi.fn() }));

import { StockOnHandTable } from './StockOnHandTable';
import { inventoryService } from '@/services/inventoryService';
import { inventoryStockService } from '@/services/inventoryStockService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { InventoryItem, StockRow, StockTotal } from '@/types/inventory';

const ADHESIVE = { id: 'i1', sku: 'ADH-01', name: 'Adhesive', tracking: 'quantity', trackStock: true } as InventoryItem;
const SINK = { id: 'i2', sku: 'SINK-01', name: 'Undermount Sink', tracking: 'quantity', trackStock: true } as InventoryItem;

function total(over: Partial<StockTotal> = {}): StockTotal {
  return { unitCode: 'EA', onHand: 12, allocated: 2, available: 10, locations: 1, belowReorder: false, ...over };
}

function stockRow(over: Partial<StockRow> = {}): StockRow {
  return {
    itemId: 'i1', sku: 'ADH-01', itemName: 'Adhesive', tracking: 'quantity', unitCode: 'EA',
    warehouseId: 1, warehouseName: 'Yard A', onHand: 12, allocated: 2, available: 10, reorderPoint: 0, ...over,
  };
}

function renderTable() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter><StockOnHandTable /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useUserPermissions).mockReturnValue({
    grants: [], isLoading: false, activeRoleId: '', isSuperAdmin: false,
    hasPermission: (resource: string, action: string) => resource === 'inventory_item' && ['read', 'update'].includes(action),
  } as ReturnType<typeof useUserPermissions>);
  vi.mocked(inventoryService.searchItems).mockResolvedValue({ records: [ADHESIVE, SINK], nextCursor: '', hasMore: false });
  vi.mocked(inventoryStockService.totals).mockResolvedValue({ i1: total(), i2: total({ onHand: 0, available: 0, locations: 0 }) });
  vi.mocked(inventoryStockService.forItem).mockResolvedValue([stockRow()]);
});

describe('StockOnHandTable', () => {
  it('asks only for counted, non-slab items', async () => {
    renderTable();
    await screen.findByText('Adhesive');

    const req = vi.mocked(inventoryService.searchItems).mock.calls[0][0];
    expect(req.filters).toEqual(expect.arrayContaining([
      { field: 'tracking', op: 'eq', value: 'quantity' },
      { field: 'track_stock', op: 'eq', value: true },
    ]));
  });

  it('shows on hand, allocated and available per item, and 0 for an item held nowhere', async () => {
    renderTable();

    const adhesive = (await screen.findByText('Adhesive')).closest('tr') as HTMLElement;
    expect(await within(adhesive).findByText('12')).toBeInTheDocument();
    expect(within(adhesive).getByText('10')).toBeInTheDocument();
    const sink = screen.getByText('Undermount Sink').closest('tr') as HTMLElement;
    expect(await within(sink).findAllByText('0')).not.toHaveLength(0);
    expect(inventoryStockService.totals).toHaveBeenCalledWith(['i1', 'i2']);
  });

  it('flags an item below its reorder point', async () => {
    vi.mocked(inventoryStockService.totals).mockResolvedValue({ i1: total({ onHand: 3, belowReorder: true }), i2: total() });
    renderTable();

    const adhesive = (await screen.findByText('Adhesive')).closest('tr') as HTMLElement;
    expect(await within(adhesive).findByText('Low stock')).toBeInTheDocument();
    expect(within(screen.getByText('Undermount Sink').closest('tr') as HTMLElement).queryByText('Low stock')).not.toBeInTheDocument();
  });

  it('opens an item to its per-location stock and reorder point', async () => {
    const user = userEvent.setup();
    renderTable();

    await user.click(await screen.findByRole('button', { name: 'Show stock by location for Adhesive' }));

    expect(await screen.findByText('Yard A')).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: 'Reorder point at Yard A' })).toBeInTheDocument();
    expect(inventoryStockService.forItem).toHaveBeenCalledWith('i1');

    await user.click(screen.getByRole('button', { name: 'Hide stock by location for Adhesive' }));
    expect(screen.queryByText('Yard A')).not.toBeInTheDocument();
  });

  it('searches by name or SKU', async () => {
    const user = userEvent.setup();
    renderTable();
    await screen.findByText('Adhesive');

    await user.type(screen.getByRole('searchbox', { name: 'Search stock' }), 'sink');

    await waitFor(() => expect(vi.mocked(inventoryService.searchItems).mock.calls.at(-1)?.[0].search).toBe('sink'));
  });

  it('says so when no counted items exist yet', async () => {
    vi.mocked(inventoryService.searchItems).mockResolvedValue({ records: [], nextCursor: '', hasMore: false });
    renderTable();
    expect(await screen.findByText(/No counted items yet/)).toBeInTheDocument();
  });
});
