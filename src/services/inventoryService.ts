import { tenantClient } from '@/api/tenantClient';
import type {
  InventoryItem, InventoryItemInput, InventoryItemPage, InventoryItemSearchRequest,
  InventoryItemHistoryEntry,
} from '@/types/inventory';

// Inventory item catalogue. Served from `/api/tenant/inventory/items*`,
// gated by the `inventory_item` RBAC resource. `item.id` is the
// `inventory_item_uuid` referenced elsewhere as `inventoryItemUuid`/
// `inventoryItemId`.
//
// PATCH has PUT semantics server-side (pre-existing, documented on
// InventoryItemInput) — always send the whole object via `updateItem`, never
// a partial patch.
const BASE = '/tenant/inventory/items';

export const inventoryService = {
  searchItems: (req: InventoryItemSearchRequest): Promise<InventoryItemPage> =>
    tenantClient
      .post<{
        success: boolean; records: InventoryItem[]; nextCursor: string; hasMore: boolean;
      }>(`${BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  getItem: (uuid: string): Promise<InventoryItem> =>
    tenantClient
      .get<{ success: boolean; item: InventoryItem }>(`${BASE}/${uuid}`)
      .then((r) => r.data.item),

  createItem: (payload: InventoryItemInput): Promise<InventoryItem> =>
    tenantClient
      .post<{ success: boolean; item: InventoryItem }>(BASE, payload)
      .then((r) => r.data.item),

  // Whole-object write — see the PUT-semantics note above.
  updateItem: (uuid: string, payload: InventoryItemInput): Promise<InventoryItem> =>
    tenantClient
      .patch<{ success: boolean; item: InventoryItem }>(`${BASE}/${uuid}`, payload)
      .then((r) => r.data.item),

  deleteItem: (uuid: string): Promise<void> =>
    tenantClient.delete(`${BASE}/${uuid}`).then(() => undefined),

  getHistory: (uuid: string): Promise<InventoryItemHistoryEntry[]> =>
    tenantClient
      .get<{ success: boolean; history: InventoryItemHistoryEntry[] }>(`${BASE}/${uuid}/history`)
      .then((r) => r.data.history ?? []),
};
