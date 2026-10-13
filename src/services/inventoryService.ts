import { tenantClient } from '@/api/tenantClient';
import type {
  InventoryItem, InventoryItemInput, InventoryItemPage, InventoryItemSearchRequest,
  InventoryItemHistoryEntry, InventoryKit, KitInput, KitPage, KitSearchRequest,
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
// Kits: named groups of items, under the same `inventory_item` grant.
const KITS_BASE = '/tenant/inventory/kits';

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

  // ── Kits ───────────────────────────────────────────────────────────────────
  // Rows carry `itemCount`; only `getKit` carries `members` (the full item
  // records), so a picker fetches the kit once it is chosen.
  searchKits: (req: KitSearchRequest): Promise<KitPage> =>
    tenantClient
      .post<{
        success: boolean; records: InventoryKit[]; nextCursor: string; hasMore: boolean;
      }>(`${KITS_BASE}/search`, req)
      .then((r) => ({
        records: r.data.records ?? [],
        nextCursor: r.data.nextCursor ?? '',
        hasMore: Boolean(r.data.hasMore),
      })),

  getKit: (uuid: string): Promise<InventoryKit> =>
    tenantClient
      .get<{ success: boolean; kit: InventoryKit }>(`${KITS_BASE}/${uuid}`)
      .then((r) => ({ ...r.data.kit, members: r.data.kit.members ?? [] })),

  createKit: (payload: KitInput): Promise<InventoryKit> =>
    tenantClient
      .post<{ success: boolean; kit: InventoryKit }>(KITS_BASE, payload)
      .then((r) => ({ ...r.data.kit, members: r.data.kit.members ?? [] })),

  // Whole-object write; `members` omitted leaves the kit's items alone.
  updateKit: (uuid: string, payload: KitInput): Promise<void> =>
    tenantClient.patch(`${KITS_BASE}/${uuid}`, payload).then(() => undefined),

  deleteKit: (uuid: string): Promise<void> =>
    tenantClient.delete(`${KITS_BASE}/${uuid}`).then(() => undefined),
};
