import type { Warehouse } from '@/types/inventory';

// KNOWN GAP: every document write contract (units, bundles, adjustments,
// transfers, counts) takes `warehouseId` as the numeric lkp_warehouse SERIAL,
// which no endpoint currently returns — GET /inventory/lookups and
// /inventory/warehouses only expose the uuid. There is no client-side way to
// bridge that. This is the single place the gap is handled: it returns 0 (an
// invalid id) when only the uuid is known, which the server rejects with its
// own clear validation message ("An adjustment needs a warehouse.") rather
// than silently misrouting the write. Once the backend exposes a numeric id
// alongside the uuid, wiring it through here is the only change needed.
//
// Kept out of components/inventory/WarehouseSelect.tsx so that file only
// exports a component (eslint-plugin-react-refresh's `vite` preset errors on
// a component file exporting a plain function too).
export function toNumericWarehouseId(warehouses: Warehouse[], uuid: string): number {
  const w = warehouses.find((x) => x.id === uuid) as (Warehouse & { warehouseId?: number }) | undefined;
  return w?.warehouseId ?? 0;
}
