// Pure filter-state helpers behind PurchaseOrderFilterDrawer — kept out of
// the component file because eslint-plugin-react-refresh's `vite` preset
// errors on a component file exporting non-component bindings (breaks Fast
// Refresh for that file).
import type { FilterClause } from '@/types/tenant';

export interface PurchaseOrderFilterState {
  vendorName: string;
  recordNumber: string;
  referenceNumber: string;
  orderDateFrom: string;
  orderDateTo: string;
  expectedDateFrom: string;
  expectedDateTo: string;
  grandTotalMin: string;
  grandTotalMax: string;
  ownerId: string;
  customFields: Record<string, string>;
}

export const EMPTY_FILTER_STATE: PurchaseOrderFilterState = {
  vendorName: '', recordNumber: '', referenceNumber: '',
  orderDateFrom: '', orderDateTo: '', expectedDateFrom: '', expectedDateTo: '',
  grandTotalMin: '', grandTotalMax: '', ownerId: '', customFields: {},
};

export function hasActiveFilters(f: PurchaseOrderFilterState): boolean {
  return Boolean(
    f.vendorName || f.recordNumber || f.referenceNumber
    || f.orderDateFrom || f.orderDateTo || f.expectedDateFrom || f.expectedDateTo
    || f.grandTotalMin || f.grandTotalMax || f.ownerId
    || Object.values(f.customFields).some(Boolean),
  );
}

/** Builds the server FilterClause[] from drawer state — date/amount ranges
 *  become a pair of gte/lte clauses rather than a single 'between' (keeps
 *  the value shape unambiguous; the Record Filter Engine accepts either). */
export function toFilterClauses(f: PurchaseOrderFilterState): FilterClause[] {
  const clauses: FilterClause[] = [];
  if (f.vendorName) clauses.push({ field: 'vendor_name', op: 'contains', value: f.vendorName });
  if (f.recordNumber) clauses.push({ field: 'record_number', op: 'contains', value: f.recordNumber });
  if (f.referenceNumber) clauses.push({ field: 'reference_number', op: 'contains', value: f.referenceNumber });
  if (f.orderDateFrom) clauses.push({ field: 'order_date', op: 'gte', value: f.orderDateFrom });
  if (f.orderDateTo) clauses.push({ field: 'order_date', op: 'lte', value: f.orderDateTo });
  if (f.expectedDateFrom) clauses.push({ field: 'expected_date', op: 'gte', value: f.expectedDateFrom });
  if (f.expectedDateTo) clauses.push({ field: 'expected_date', op: 'lte', value: f.expectedDateTo });
  if (f.grandTotalMin) clauses.push({ field: 'grand_total', op: 'gte', value: Number(f.grandTotalMin) });
  if (f.grandTotalMax) clauses.push({ field: 'grand_total', op: 'lte', value: Number(f.grandTotalMax) });
  if (f.ownerId) clauses.push({ field: 'owner_id', op: 'eq', value: f.ownerId });
  for (const [key, val] of Object.entries(f.customFields)) {
    if (val) clauses.push({ field: `cf:${key}`, op: 'contains', value: val });
  }
  return clauses;
}
