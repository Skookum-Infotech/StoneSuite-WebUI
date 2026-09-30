import type { Warehouse } from '@/types/inventory';

// A "warehouse" is one of the tenant's Company Info locations (see
// types/inventory.ts). The pickers bind to the location's uuid (`id`); every
// document write contract (units, bundles, adjustments, transfers, counts,
// receipts) takes the numeric `warehouseId`. These helpers convert between the
// two in one place.
//
// Kept out of components/inventory/WarehouseSelect.tsx so that file only
// exports a component (eslint-plugin-react-refresh's `vite` preset errors on
// a component file exporting a plain function too).

/** The numeric id for a picked location's uuid. 0 (an invalid id) when it can't
 *  be matched — the lookups haven't loaded yet — which the server rejects with
 *  its own clear validation message rather than silently misrouting the write. */
export function toNumericWarehouseId(warehouses: Warehouse[], uuid: string): number {
  return warehouses.find((x) => x.id === uuid)?.warehouseId ?? 0;
}

/** The inverse of `toNumericWarehouseId`: a location's uuid from the numeric id
 *  a receipt (or other saved document) carries. Empty when it can't be matched —
 *  the lookups haven't loaded yet, or the location was since removed. */
export function toWarehouseUuid(warehouses: Warehouse[], numericId: number | null | undefined): string {
  if (numericId === null || numericId === undefined) return '';
  const w = warehouses.find((x) => x.warehouseId === numericId);
  return w?.id ?? '';
}

/** The tenant's default location (its uuid) — what a new record's location
 *  picker starts on — or empty when none is set. */
export function defaultWarehouseUuid(warehouses: Warehouse[]): string {
  return warehouses.find((w) => w.isDefault)?.id ?? '';
}
