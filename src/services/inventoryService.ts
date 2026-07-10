import { tenantClient } from '@/api/tenantClient';
import type { FilterClause, SortKey } from '@/types/tenant';

// Inventory item catalog. Its own shared domain (design AD-2) served from
// `/api/tenant/inventory/items*`, gated by the `inventory_item` RBAC resource.
// The Sales Order line-item picker reads this catalog; `item.id` is the
// `inventory_item_uuid` passed to a line as `inventoryItemUuid`.
const BASE = '/tenant/inventory/items';

export interface InventoryItem {
  id: string;                 // inventory_item_uuid
  sku: string;
  name: string;
  description: string;
  unitId: number;
  unitPrice: number;
  currencyId?: number | null;
  taxRateId?: number | null;
  isActive: boolean;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItemSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface InventoryItemPage {
  records: InventoryItem[];
  nextCursor: string;
  hasMore: boolean;
}

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
};
