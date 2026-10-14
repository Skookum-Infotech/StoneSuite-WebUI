import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/api/tenantClient', () => ({
  tenantClient: { get: vi.fn(), post: vi.fn(), put: vi.fn(), patch: vi.fn(), delete: vi.fn() },
}));

import { tenantClient } from '@/api/tenantClient';
import { inventoryBinService } from './inventoryBinService';

describe('inventoryBinService.getHistory', () => {
  beforeEach(() => vi.clearAllMocks());

  it('reads one bin\'s movement history, passing paging and direction through', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({
      data: { success: true, records: [{ action: 'bin_move' }], nextCursor: 'next', hasMore: true },
    });

    const page = await inventoryBinService.getHistory('bin-1', { cursor: 'c1', direction: 'in', limit: 20 });

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/inventory/bins/bin-1/history', {
      params: { cursor: 'c1', direction: 'in', limit: 20 },
    });
    expect(page).toEqual({ records: [{ action: 'bin_move' }], nextCursor: 'next', hasMore: true });
  });

  it('sends no params it was not given and normalises an empty page', async () => {
    vi.mocked(tenantClient.get).mockResolvedValue({ data: { success: true } });

    const page = await inventoryBinService.getHistory('bin-1');

    expect(tenantClient.get).toHaveBeenCalledWith('/tenant/inventory/bins/bin-1/history', { params: {} });
    expect(page).toEqual({ records: [], nextCursor: '', hasMore: false });
  });
});
