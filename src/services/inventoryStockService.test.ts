import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { inventoryStockService } from './inventoryStockService';

describe('inventoryStockService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads one item\'s stock per location', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true, records: [{ warehouseName: 'Yard A', onHand: 4 }] } });

    const rows = await inventoryStockService.forItem('item-1');

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/inventory/items/item-1/stock');
    expect(rows).toEqual([{ warehouseName: 'Yard A', onHand: 4 }]);
  });

  it('treats an item held nowhere as an empty list', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true } });
    expect(await inventoryStockService.forItem('item-1')).toEqual([]);
  });

  it('asks for the totals of the listed items only', async () => {
    vi.mocked(tenantClient.post).mockResolvedValue({ data: { success: true, totals: { 'item-1': { onHand: 4 } } } });

    const totals = await inventoryStockService.totals(['item-1', 'item-2']);

    expect(tenantClient.post).toHaveBeenCalledWith('/tenant/inventory/stock/totals', { itemIds: ['item-1', 'item-2'] });
    expect(totals).toEqual({ 'item-1': { onHand: 4 } });
  });

  it('makes no request for an empty page of items', async () => {
    expect(await inventoryStockService.totals([])).toEqual({});
    expect(tenantClient.post).not.toHaveBeenCalled();
  });

  it('saves a reorder point and returns the refreshed row', async () => {
    vi.mocked(tenantClient.patch).mockResolvedValue({ data: { success: true, record: { reorderPoint: 5 } } });

    const row = await inventoryStockService.setReorderPoint({ itemId: 'item-1', warehouseId: 3, reorderPoint: 5 });

    expect(tenantClient.patch).toHaveBeenCalledWith('/tenant/inventory/stock/reorder-point', { itemId: 'item-1', warehouseId: 3, reorderPoint: 5 });
    expect(row).toEqual({ reorderPoint: 5 });
  });
});
