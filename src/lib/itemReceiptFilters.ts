// Pure filter-state helpers behind ItemReceiptFilterDrawer — kept out of the
// component file because eslint-plugin-react-refresh's `vite` preset errors
// on a component file exporting non-component bindings (mirrors
// purchaseOrderFilters.ts).
import type { FilterClause } from '@/types/tenant';

export interface ItemReceiptFilterState {
  recordNumber: string;
  purchaseOrderNumber: string;
  vendorName: string;
  packingSlip: string;
  carrier: string;
  trackingNumber: string;
  receiptDateFrom: string;
  receiptDateTo: string;
  createdAtFrom: string;
  createdAtTo: string;
  updatedAtFrom: string;
  updatedAtTo: string;
  ownerId: string;
  customFields: Record<string, string>;
}

export const EMPTY_FILTER_STATE: ItemReceiptFilterState = {
  recordNumber: '', purchaseOrderNumber: '', vendorName: '',
  packingSlip: '', carrier: '', trackingNumber: '',
  receiptDateFrom: '', receiptDateTo: '',
  createdAtFrom: '', createdAtTo: '', updatedAtFrom: '', updatedAtTo: '',
  ownerId: '', customFields: {},
};

export function hasActiveFilters(f: ItemReceiptFilterState): boolean {
  return Boolean(
    f.recordNumber || f.purchaseOrderNumber || f.vendorName
    || f.packingSlip || f.carrier || f.trackingNumber
    || f.receiptDateFrom || f.receiptDateTo
    || f.createdAtFrom || f.createdAtTo || f.updatedAtFrom || f.updatedAtTo
    || f.ownerId
    || Object.values(f.customFields).some(Boolean),
  );
}

// `status`, `vendor_id`, `purchase_order_id` and `warehouse_id` are
// deliberately not offered here: all four compare against internal integer
// or UUID ids server-side (itemreceipt/resolver.go systemFields), and no
// lookup endpoint exposes IRCT status ids, vendor ids, purchase order ids, or
// warehouse ids to filter by — mirrors PurchaseOrderFilterDrawer's omission
// of `status`/`vendor_id` for the same reason. `vendor_name` and
// `purchase_order_number` (both plain ILIKE text columns) cover the
// practical search need instead.
export function toFilterClauses(f: ItemReceiptFilterState): FilterClause[] {
  const clauses: FilterClause[] = [];
  if (f.recordNumber) clauses.push({ field: 'record_number', op: 'contains', value: f.recordNumber });
  if (f.purchaseOrderNumber) clauses.push({ field: 'purchase_order_number', op: 'contains', value: f.purchaseOrderNumber });
  if (f.vendorName) clauses.push({ field: 'vendor_name', op: 'contains', value: f.vendorName });
  if (f.packingSlip) clauses.push({ field: 'packing_slip', op: 'contains', value: f.packingSlip });
  if (f.carrier) clauses.push({ field: 'carrier', op: 'contains', value: f.carrier });
  if (f.trackingNumber) clauses.push({ field: 'tracking_number', op: 'contains', value: f.trackingNumber });
  if (f.receiptDateFrom) clauses.push({ field: 'receipt_date', op: 'gte', value: f.receiptDateFrom });
  if (f.receiptDateTo) clauses.push({ field: 'receipt_date', op: 'lte', value: f.receiptDateTo });
  if (f.createdAtFrom) clauses.push({ field: 'created_at', op: 'gte', value: f.createdAtFrom });
  if (f.createdAtTo) clauses.push({ field: 'created_at', op: 'lte', value: f.createdAtTo });
  if (f.updatedAtFrom) clauses.push({ field: 'updated_at', op: 'gte', value: f.updatedAtFrom });
  if (f.updatedAtTo) clauses.push({ field: 'updated_at', op: 'lte', value: f.updatedAtTo });
  if (f.ownerId) clauses.push({ field: 'owner_id', op: 'eq', value: f.ownerId });
  for (const [key, val] of Object.entries(f.customFields)) {
    if (val) clauses.push({ field: `cf:${key}`, op: 'contains', value: val });
  }
  return clauses;
}
