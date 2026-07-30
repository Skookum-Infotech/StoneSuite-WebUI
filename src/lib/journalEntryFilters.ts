// Pure filter-state helpers behind JournalEntryFilterDrawer — kept out of the
// component file because eslint-plugin-react-refresh's `vite` preset errors
// on a component file exporting non-component bindings (mirrors
// itemReceiptFilters.ts).
import type { FilterClause } from '@/types/tenant';

export interface JournalEntryFilterState {
  recordNumber: string;
  reference: string;
  transferDateFrom: string;
  transferDateTo: string;
  amountMin: string;
  amountMax: string;
  createdAtFrom: string;
  createdAtTo: string;
  updatedAtFrom: string;
  updatedAtTo: string;
  ownerId: string;
  customFields: Record<string, string>;
}

export const EMPTY_FILTER_STATE: JournalEntryFilterState = {
  recordNumber: '', reference: '',
  transferDateFrom: '', transferDateTo: '',
  amountMin: '', amountMax: '',
  createdAtFrom: '', createdAtTo: '', updatedAtFrom: '', updatedAtTo: '',
  ownerId: '', customFields: {},
};

export function hasActiveFilters(f: JournalEntryFilterState): boolean {
  return Boolean(
    f.recordNumber || f.reference
    || f.transferDateFrom || f.transferDateTo
    || f.amountMin || f.amountMax
    || f.createdAtFrom || f.createdAtTo || f.updatedAtFrom || f.updatedAtTo
    || f.ownerId
    || Object.values(f.customFields).some(Boolean),
  );
}

// `status`, `from_account_id` and `to_account_id` are deliberately not
// offered here: all three compare against internal integer ids server-side
// (cashtransfer/resolver.go systemFields), and no lookup endpoint exposes
// cash transfer status ids or accounts' internal integer ids to filter by —
// mirrors ItemReceiptFilterDrawer's omission of `status`/`vendor_id` for the
// same reason. `reference` (a plain ILIKE text column) and the global search
// box (which also matches account-adjacent free text via the notes field)
// cover the practical search need instead.
export function toFilterClauses(f: JournalEntryFilterState): FilterClause[] {
  const clauses: FilterClause[] = [];
  if (f.recordNumber) clauses.push({ field: 'record_number', op: 'contains', value: f.recordNumber });
  if (f.reference) clauses.push({ field: 'reference', op: 'contains', value: f.reference });
  if (f.transferDateFrom) clauses.push({ field: 'transfer_date', op: 'gte', value: f.transferDateFrom });
  if (f.transferDateTo) clauses.push({ field: 'transfer_date', op: 'lte', value: f.transferDateTo });
  if (f.amountMin) clauses.push({ field: 'amount', op: 'gte', value: Number(f.amountMin) });
  if (f.amountMax) clauses.push({ field: 'amount', op: 'lte', value: Number(f.amountMax) });
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
