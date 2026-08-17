// Pure filter-state helpers behind ExpenseFilterDrawer — kept out of the
// component file because eslint-plugin-react-refresh's `vite` preset errors on
// a component file exporting non-component bindings (breaks Fast Refresh for
// that file). Mirrors lib/requisitionFilters.ts.
import type { FilterClause } from '@/types/tenant';

export interface ExpenseFilterState {
  recordNumber: string;
  department: string;
  claimantId: string;
  totalMin: string;
  totalMax: string;
  customFields: Record<string, string>;
}

export const EMPTY_FILTER_STATE: ExpenseFilterState = {
  recordNumber: '', department: '', claimantId: '', totalMin: '', totalMax: '',
  customFields: {},
};

export function hasActiveFilters(f: ExpenseFilterState): boolean {
  return Boolean(
    f.recordNumber || f.department || f.claimantId || f.totalMin || f.totalMax
    || Object.values(f.customFields).some(Boolean),
  );
}

/** Builds the server FilterClause[] from drawer state. Every field key here
 *  must appear in expense/resolver.go's `systemFields` whitelist — an unknown
 *  key comes back as a 400 InvalidFilterError, which the table surfaces as a
 *  filter error rather than a generic failure. */
export function toFilterClauses(f: ExpenseFilterState): FilterClause[] {
  const clauses: FilterClause[] = [];
  if (f.recordNumber) clauses.push({ field: 'record_number', op: 'contains', value: f.recordNumber });
  if (f.department) clauses.push({ field: 'department', op: 'contains', value: f.department });
  if (f.claimantId) clauses.push({ field: 'claimant_id', op: 'eq', value: f.claimantId });
  if (f.totalMin) clauses.push({ field: 'total', op: 'gte', value: Number(f.totalMin) });
  if (f.totalMax) clauses.push({ field: 'total', op: 'lte', value: Number(f.totalMax) });
  for (const [key, val] of Object.entries(f.customFields)) {
    if (val) clauses.push({ field: `cf:${key}`, op: 'contains', value: val });
  }
  return clauses;
}
