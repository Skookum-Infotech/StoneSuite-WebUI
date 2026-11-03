import { tenantClient } from '@/api/tenantClient';
import type { ReorderPointInput, StockRow, StockTotal } from '@/types/inventory';

// Stock on hand, per item and location. Served from `/api/tenant/inventory/*`
// and gated by the `inventory_item` RBAC resource (read for the figures,
// update for a reorder point). The server works out `available`; nothing here
// recomputes it.
const BASE = '/tenant/inventory';

export const inventoryStockService = {
  // An item held nowhere has no rows: an empty list, not an error.
  forItem: (itemId: string): Promise<StockRow[]> =>
    tenantClient
      .get<{ success: boolean; records: StockRow[] }>(`${BASE}/items/${itemId}/stock`)
      .then((r) => r.data.records ?? []),

  // Totals for the items on screen, keyed by item uuid. An empty page asks for
  // nothing — the list calls this before its rows have loaded.
  totals: (itemIds: string[]): Promise<Record<string, StockTotal>> => {
    if (itemIds.length === 0) return Promise.resolve({});
    return tenantClient
      .post<{ success: boolean; totals: Record<string, StockTotal> }>(`${BASE}/stock/totals`, { itemIds })
      .then((r) => r.data.totals ?? {});
  },

  setReorderPoint: (input: ReorderPointInput): Promise<StockRow> =>
    tenantClient
      .patch<{ success: boolean; record: StockRow }>(`${BASE}/stock/reorder-point`, input)
      .then((r) => r.data.record),
};
