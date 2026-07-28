// Pure filter-state helpers behind the Inventory Item list's filter drawer —
// kept out of the component file (eslint-plugin-react-refresh's `vite`
// preset errors on a component file exporting non-component bindings).
import type { FilterClause } from '@/types/tenant';

export interface InventoryItemFilterState {
  sku: string;
  name: string;
  tracking: string;
  materialId: string;
  colorId: string;
  finishId: string;
  originCountryId: string;
  defaultWarehouseId: string;
  barcode: string;
  isActive: string; // '' | 'true' | 'false'
  thicknessMin: string;
  thicknessMax: string;
  unitPriceMin: string;
  unitPriceMax: string;
}

export const EMPTY_FILTER_STATE: InventoryItemFilterState = {
  sku: '', name: '', tracking: '', materialId: '', colorId: '', finishId: '',
  originCountryId: '', defaultWarehouseId: '', barcode: '', isActive: '',
  thicknessMin: '', thicknessMax: '', unitPriceMin: '', unitPriceMax: '',
};

export function hasActiveFilters(f: InventoryItemFilterState): boolean {
  return Object.values(f).some((v) => v !== '');
}

/** Builds the server FilterClause[] from drawer state. thickness_mm and
 *  unit_price are true range fields server-side (gt/gte/lt/lte/between) —
 *  "20mm vs 30mm" is a real query, expressed here as a gte/lte pair. */
export function toFilterClauses(f: InventoryItemFilterState): FilterClause[] {
  const clauses: FilterClause[] = [];
  if (f.sku) clauses.push({ field: 'sku', op: 'contains', value: f.sku });
  if (f.name) clauses.push({ field: 'name', op: 'contains', value: f.name });
  if (f.tracking) clauses.push({ field: 'tracking', op: 'eq', value: f.tracking });
  if (f.materialId) clauses.push({ field: 'material_id', op: 'eq', value: Number(f.materialId) });
  if (f.colorId) clauses.push({ field: 'color_id', op: 'eq', value: Number(f.colorId) });
  if (f.finishId) clauses.push({ field: 'finish_id', op: 'eq', value: Number(f.finishId) });
  if (f.originCountryId) clauses.push({ field: 'origin_country_id', op: 'eq', value: Number(f.originCountryId) });
  if (f.defaultWarehouseId) clauses.push({ field: 'default_warehouse_id', op: 'eq', value: Number(f.defaultWarehouseId) });
  if (f.barcode) clauses.push({ field: 'barcode', op: 'contains', value: f.barcode });
  if (f.isActive) clauses.push({ field: 'is_active', op: 'eq', value: f.isActive === 'true' });
  if (f.thicknessMin) clauses.push({ field: 'thickness_mm', op: 'gte', value: Number(f.thicknessMin) });
  if (f.thicknessMax) clauses.push({ field: 'thickness_mm', op: 'lte', value: Number(f.thicknessMax) });
  if (f.unitPriceMin) clauses.push({ field: 'unit_price', op: 'gte', value: Number(f.unitPriceMin) });
  if (f.unitPriceMax) clauses.push({ field: 'unit_price', op: 'lte', value: Number(f.unitPriceMax) });
  return clauses;
}
