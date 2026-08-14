// Pure filter-state helpers behind VendorCreditFilterDrawer — kept out of the
// component file because eslint-plugin-react-refresh's `vite` preset errors on
// a component file exporting non-component bindings (mirrors
// vendorPaymentFilters.ts).
import type { FilterClause } from '@/types/tenant';

export interface VendorCreditFilterState {
  recordNumber: string;
  referenceNumber: string;
  reason: string;
  creditDateFrom: string;
  creditDateTo: string;
  amountMin: string;
  amountMax: string;
  unappliedMin: string;
  unappliedMax: string;
  ownerId: string;
  customFields: Record<string, string>;
}

export const EMPTY_FILTER_STATE: VendorCreditFilterState = {
  recordNumber: '', referenceNumber: '', reason: '',
  creditDateFrom: '', creditDateTo: '',
  amountMin: '', amountMax: '', unappliedMin: '', unappliedMax: '',
  ownerId: '', customFields: {},
};

export function hasActiveFilters(f: VendorCreditFilterState): boolean {
  return Boolean(
    f.recordNumber || f.referenceNumber || f.reason
    || f.creditDateFrom || f.creditDateTo
    || f.amountMin || f.amountMax || f.unappliedMin || f.unappliedMax
    || f.ownerId
    || Object.values(f.customFields).some(Boolean),
  );
}

/** Builds the server FilterClause[] from drawer state — date/amount ranges
 *  become a pair of gte/lte clauses rather than a single 'between' (keeps the
 *  value shape unambiguous; the Record Filter Engine accepts either). Field
 *  keys are the vendor_credit resolver's whitelist (vendorcredit/resolver.go
 *  systemFields); anything outside it comes back as a 400 InvalidFilterError,
 *  which the table surfaces rather than swallowing. */
export function toFilterClauses(f: VendorCreditFilterState): FilterClause[] {
  const clauses: FilterClause[] = [];
  if (f.recordNumber) clauses.push({ field: 'record_number', op: 'contains', value: f.recordNumber });
  if (f.referenceNumber) clauses.push({ field: 'reference_number', op: 'contains', value: f.referenceNumber });
  if (f.reason) clauses.push({ field: 'reason', op: 'contains', value: f.reason });
  if (f.creditDateFrom) clauses.push({ field: 'credit_date', op: 'gte', value: f.creditDateFrom });
  if (f.creditDateTo) clauses.push({ field: 'credit_date', op: 'lte', value: f.creditDateTo });
  if (f.amountMin) clauses.push({ field: 'grand_total', op: 'gte', value: Number(f.amountMin) });
  if (f.amountMax) clauses.push({ field: 'grand_total', op: 'lte', value: Number(f.amountMax) });
  if (f.unappliedMin) clauses.push({ field: 'unapplied_amount', op: 'gte', value: Number(f.unappliedMin) });
  if (f.unappliedMax) clauses.push({ field: 'unapplied_amount', op: 'lte', value: Number(f.unappliedMax) });
  if (f.ownerId) clauses.push({ field: 'owner_id', op: 'eq', value: f.ownerId });
  for (const [key, val] of Object.entries(f.customFields)) {
    if (val) clauses.push({ field: `cf:${key}`, op: 'contains', value: val });
  }
  return clauses;
}
