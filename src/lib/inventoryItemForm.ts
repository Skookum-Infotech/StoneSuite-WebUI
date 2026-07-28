// Inventory Item form field definitions and payload mapping — mirrors
// lib/purchaseOrderForm.ts's shape, adapted to the Inventory Item backend
// contract (types/inventory.ts). Field keys are UI-facing snake_case, mapped
// to the InventoryItemInput camelCase contract via toItemPayload.
//
// PATCH /inventory/items/{uuid} has PUT semantics: it overwrites every
// field. toItemPayload always builds the whole object — never a partial —
// so an edit save can never silently clear an attribute the form didn't
// touch.
import type { InventoryItem, InventoryItemInput, TrackingMode } from '@/types/inventory';
import { TRACKING_QUANTITY, TRACKING_SERIALIZED } from '@/types/inventory';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'history', label: 'History' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export const TRACKING_OPTIONS: { value: TrackingMode; label: string }[] = [
  { value: TRACKING_QUANTITY, label: 'Quantity' },
  { value: TRACKING_SERIALIZED, label: 'Serialized (slabs)' },
];

function toNum(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

function toIntOrNull(v: unknown): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

function idOrEmpty(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

export function itemDefaults(): Record<string, unknown> {
  return {
    sku: '',
    name: '',
    description: '',
    unit_id: '',
    unit_price: '0',
    currency_id: '',
    tax_rate_id: '',
    is_active: true,
    tracking: TRACKING_QUANTITY,
    material_id: '',
    color_id: '',
    finish_id: '',
    thickness_mm: '0',
    origin_country_id: '',
    default_warehouse_id: '',
    barcode: '',
  };
}

/** Maps the item form state to the whole-object write contract. */
export function toItemPayload(data: Record<string, unknown>): InventoryItemInput {
  return {
    sku: toStr(data.sku).trim(),
    name: toStr(data.name).trim(),
    description: toStr(data.description),
    unitId: toIntOrNull(data.unit_id) ?? 0,
    unitPrice: toNum(data.unit_price),
    currencyId: toIntOrNull(data.currency_id),
    taxRateId: toIntOrNull(data.tax_rate_id),
    customFields: {},
    tracking: (data.tracking === TRACKING_SERIALIZED ? TRACKING_SERIALIZED : TRACKING_QUANTITY),
    materialId: toIntOrNull(data.material_id),
    colorId: toIntOrNull(data.color_id),
    finishId: toIntOrNull(data.finish_id),
    thicknessMm: toNum(data.thickness_mm),
    originCountryId: toIntOrNull(data.origin_country_id),
    barcode: toStr(data.barcode).trim(),
    defaultWarehouseId: toIntOrNull(data.default_warehouse_id),
  };
}

/** Maps a loaded InventoryItem (GET response) back to the Edit form's state. */
export function fromItem(item: InventoryItem): Record<string, unknown> {
  return {
    sku: item.sku ?? '',
    name: item.name ?? '',
    description: item.description ?? '',
    unit_id: idOrEmpty(item.unitId),
    unit_price: String(item.unitPrice ?? 0),
    currency_id: idOrEmpty(item.currencyId),
    tax_rate_id: idOrEmpty(item.taxRateId),
    is_active: item.isActive,
    tracking: item.tracking ?? TRACKING_QUANTITY,
    material_id: idOrEmpty(item.materialId),
    color_id: idOrEmpty(item.colorId),
    finish_id: idOrEmpty(item.finishId),
    thickness_mm: String(item.thicknessMm ?? 0),
    origin_country_id: idOrEmpty(item.originCountryId),
    default_warehouse_id: idOrEmpty(item.defaultWarehouseId),
    barcode: item.barcode ?? '',
  };
}

export interface ItemFieldError {
  key: string;
  label: string;
}

/** Required-field check the backend also enforces (sku/name/unitId) —
 *  catches the common miss before a round trip, not a substitute for
 *  server-side validation. */
export function validateItem(data: Record<string, unknown>): ItemFieldError[] {
  const errors: ItemFieldError[] = [];
  if (!toStr(data.sku).trim()) errors.push({ key: 'sku', label: 'SKU' });
  if (!toStr(data.name).trim()) errors.push({ key: 'name', label: 'Item Name' });
  if (!toIntOrNull(data.unit_id)) errors.push({ key: 'unit_id', label: 'Unit' });
  return errors;
}
