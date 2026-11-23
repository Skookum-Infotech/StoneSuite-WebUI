import { tenantClient } from '@/api/tenantClient';
import type { AllLookups, LookupItem, LookupInput, LookupKind, Warehouse } from '@/types/inventory';

// Inventory vocabularies (materials, colors, finishes, reasons, units,
// tax-rates) — `inventory_lookup` RBAC resource, its own grant distinct from
// `inventory_item` (a bin clerk who can't touch the catalogue still needs the
// vocabularies to fill in a bin or unit form) — and the locations stock is held
// at. Locations are read-only here: they are created, edited, made the default
// and deleted only from Configuration → Company Info → Locations.
const LOOKUPS_BASE = '/tenant/inventory/lookups';
const WAREHOUSES_BASE = '/tenant/inventory/warehouses';

export const inventoryLookupService = {
  // Everything an item/unit/bin/document form needs on open, in one call.
  getAll: (): Promise<AllLookups> =>
    tenantClient.get<AllLookups & { success: boolean }>(LOOKUPS_BASE).then((r) => r.data),

  list: (kind: LookupKind, includeInactive = false): Promise<LookupItem[]> =>
    tenantClient
      .get<{ success: boolean; records: LookupItem[] }>(`${LOOKUPS_BASE}/${kind}`, {
        params: includeInactive ? { includeInactive: 'true' } : undefined,
      })
      .then((r) => r.data.records ?? []),

  // Rejected server-side (400) for 'units'/'tax-rates' — read-only vocabularies.
  create: (kind: LookupKind, payload: LookupInput): Promise<LookupItem> =>
    tenantClient
      .post<{ success: boolean; record: LookupItem }>(`${LOOKUPS_BASE}/${kind}`, payload)
      .then((r) => r.data.record),

  update: (kind: LookupKind, id: number, payload: LookupInput): Promise<LookupItem> =>
    tenantClient
      .patch<{ success: boolean; record: LookupItem }>(`${LOOKUPS_BASE}/${kind}/${id}`, payload)
      .then((r) => r.data.record),

  remove: (kind: LookupKind, id: number): Promise<void> =>
    tenantClient.delete(`${LOOKUPS_BASE}/${kind}/${id}`).then(() => undefined),

  listWarehouses: (): Promise<Warehouse[]> =>
    tenantClient
      .get<{ success: boolean; records: Warehouse[] }>(WAREHOUSES_BASE)
      .then((r) => r.data.records ?? []),

  getWarehouse: (uuid: string): Promise<Warehouse> =>
    tenantClient
      .get<{ success: boolean; warehouse: Warehouse }>(`${WAREHOUSES_BASE}/${uuid}`)
      .then((r) => r.data.warehouse),
};
