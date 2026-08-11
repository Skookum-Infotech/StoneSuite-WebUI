// Pure filter-state helpers behind VendorBillFilterDrawer — kept out of the
// component file because eslint-plugin-react-refresh's `vite` preset errors
// on a component file exporting non-component bindings (mirrors
// purchaseOrderFilters.ts).
import type { FilterClause } from '@/types/tenant';

export interface VendorBillFilterState {
  vendorInvoiceNumber: string;
  recordNumber: string;
  billDateFrom: string;
  billDateTo: string;
  dueDateFrom: string;
  dueDateTo: string;
  grandTotalMin: string;
  grandTotalMax: string;
  balanceDueMin: string;
  balanceDueMax: string;
  ownerId: string;
  customFields: Record<string, string>;
}

export const EMPTY_FILTER_STATE: VendorBillFilterState = {
  vendorInvoiceNumber: '', recordNumber: '',
  billDateFrom: '', billDateTo: '', dueDateFrom: '', dueDateTo: '',
  grandTotalMin: '', grandTotalMax: '', balanceDueMin: '', balanceDueMax: '',
  ownerId: '', customFields: {},
};

export function hasActiveFilters(f: VendorBillFilterState): boolean {
  return Boolean(
    f.vendorInvoiceNumber || f.recordNumber
    || f.billDateFrom || f.billDateTo || f.dueDateFrom || f.dueDateTo
    || f.grandTotalMin || f.grandTotalMax || f.balanceDueMin || f.balanceDueMax
    || f.ownerId
    || Object.values(f.customFields).some(Boolean),
  );
}

/** Builds the server FilterClause[] from drawer state — date/amount ranges
 *  become a pair of gte/lte clauses rather than a single 'between' (keeps
 *  the value shape unambiguous; the Record Filter Engine accepts either).
 *  Field keys are the vendor_bill resolver's whitelist (vendorbill/
 *  resolver.go systemFields). */
export function toFilterClauses(f: VendorBillFilterState): FilterClause[] {
  const clauses: FilterClause[] = [];
  if (f.vendorInvoiceNumber) clauses.push({ field: 'vendor_invoice_number', op: 'contains', value: f.vendorInvoiceNumber });
  if (f.recordNumber) clauses.push({ field: 'record_number', op: 'contains', value: f.recordNumber });
  if (f.billDateFrom) clauses.push({ field: 'bill_date', op: 'gte', value: f.billDateFrom });
  if (f.billDateTo) clauses.push({ field: 'bill_date', op: 'lte', value: f.billDateTo });
  if (f.dueDateFrom) clauses.push({ field: 'due_date', op: 'gte', value: f.dueDateFrom });
  if (f.dueDateTo) clauses.push({ field: 'due_date', op: 'lte', value: f.dueDateTo });
  if (f.grandTotalMin) clauses.push({ field: 'grand_total', op: 'gte', value: Number(f.grandTotalMin) });
  if (f.grandTotalMax) clauses.push({ field: 'grand_total', op: 'lte', value: Number(f.grandTotalMax) });
  if (f.balanceDueMin) clauses.push({ field: 'balance_due', op: 'gte', value: Number(f.balanceDueMin) });
  if (f.balanceDueMax) clauses.push({ field: 'balance_due', op: 'lte', value: Number(f.balanceDueMax) });
  if (f.ownerId) clauses.push({ field: 'owner_id', op: 'eq', value: f.ownerId });
  for (const [key, val] of Object.entries(f.customFields)) {
    if (val) clauses.push({ field: `cf:${key}`, op: 'contains', value: val });
  }
  return clauses;
}
