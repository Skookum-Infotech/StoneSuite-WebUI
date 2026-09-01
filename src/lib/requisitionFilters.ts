// Pure filter-state helpers behind RequisitionFilterDrawer — kept out of the
// component file because eslint-plugin-react-refresh's `vite` preset errors on
// a component file exporting non-component bindings (breaks Fast Refresh for
// that file). Mirrors lib/purchaseOrderFilters.ts.
import type { FilterClause } from '@/types/tenant';

export interface RequisitionFilterState {
  vendorName: string;
  recordNumber: string;
  department: string;
  priority: string;
  requestedById: string;
  neededByFrom: string;
  neededByTo: string;
  estimatedTotalMin: string;
  estimatedTotalMax: string;
  customFields: Record<string, string>;
}

export const EMPTY_FILTER_STATE: RequisitionFilterState = {
  vendorName: '', recordNumber: '', department: '', priority: '', requestedById: '',
  neededByFrom: '', neededByTo: '', estimatedTotalMin: '', estimatedTotalMax: '',
  customFields: {},
};

export function hasActiveFilters(f: RequisitionFilterState): boolean {
  return Boolean(
    f.vendorName || f.recordNumber || f.department || f.priority || f.requestedById
    || f.neededByFrom || f.neededByTo || f.estimatedTotalMin || f.estimatedTotalMax
    || Object.values(f.customFields).some(Boolean),
  );
}

/** Builds the server FilterClause[] from drawer state. Every field key here
 *  must appear in requisition/resolver.go's `systemFields` whitelist — an
 *  unknown key comes back as a 400 InvalidFilterError, which the table
 *  surfaces as a filter error rather than a generic failure.
 *
 *  Date/amount ranges become a pair of gte/lte clauses rather than a single
 *  'between' (keeps the value shape unambiguous; the Record Filter Engine
 *  accepts either). */
export function toFilterClauses(f: RequisitionFilterState): FilterClause[] {
  const clauses: FilterClause[] = [];
  if (f.vendorName) clauses.push({ field: 'vendor_name', op: 'contains', value: f.vendorName });
  if (f.recordNumber) clauses.push({ field: 'record_number', op: 'contains', value: f.recordNumber });
  if (f.department) clauses.push({ field: 'department', op: 'contains', value: f.department });
  if (f.priority) clauses.push({ field: 'priority', op: 'eq', value: f.priority });
  if (f.requestedById) clauses.push({ field: 'requested_by_id', op: 'eq', value: f.requestedById });
  if (f.neededByFrom) clauses.push({ field: 'needed_by_date', op: 'gte', value: f.neededByFrom });
  if (f.neededByTo) clauses.push({ field: 'needed_by_date', op: 'lte', value: f.neededByTo });
  if (f.estimatedTotalMin) clauses.push({ field: 'estimated_total', op: 'gte', value: Number(f.estimatedTotalMin) });
  if (f.estimatedTotalMax) clauses.push({ field: 'estimated_total', op: 'lte', value: Number(f.estimatedTotalMax) });
  for (const [key, val] of Object.entries(f.customFields)) {
    if (val) clauses.push({ field: `cf:${key}`, op: 'contains', value: val });
  }
  return clauses;
}
