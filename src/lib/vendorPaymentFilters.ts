// Pure filter-state helpers behind VendorPaymentFilterDrawer — kept out of the
// component file because eslint-plugin-react-refresh's `vite` preset errors on
// a component file exporting non-component bindings (mirrors
// vendorBillFilters.ts).
import type { FilterClause } from '@/types/tenant';

export interface VendorPaymentFilterState {
  recordNumber: string;
  referenceNumber: string;
  paymentDateFrom: string;
  paymentDateTo: string;
  scheduledDateFrom: string;
  scheduledDateTo: string;
  amountMin: string;
  amountMax: string;
  unappliedMin: string;
  unappliedMax: string;
  /** 'none' | 'pending' | 'approved' — a plain VARCHAR column, so unlike
   *  `status`/`vendor_id` (internal integer ids) it filters cleanly by value. */
  approvalStatus: string;
  /** lkp_payment_method id — filterable because PAYMENT_METHODS already
   *  mirrors the seed order client-side (lib/paymentMethods.ts). */
  methodId: string;
  ownerId: string;
  customFields: Record<string, string>;
}

export const EMPTY_FILTER_STATE: VendorPaymentFilterState = {
  recordNumber: '', referenceNumber: '',
  paymentDateFrom: '', paymentDateTo: '', scheduledDateFrom: '', scheduledDateTo: '',
  amountMin: '', amountMax: '', unappliedMin: '', unappliedMax: '',
  approvalStatus: '', methodId: '', ownerId: '', customFields: {},
};

export function hasActiveFilters(f: VendorPaymentFilterState): boolean {
  return Boolean(
    f.recordNumber || f.referenceNumber
    || f.paymentDateFrom || f.paymentDateTo || f.scheduledDateFrom || f.scheduledDateTo
    || f.amountMin || f.amountMax || f.unappliedMin || f.unappliedMax
    || f.approvalStatus || f.methodId || f.ownerId
    || Object.values(f.customFields).some(Boolean),
  );
}

/** Builds the server FilterClause[] from drawer state — date/amount ranges
 *  become a pair of gte/lte clauses rather than a single 'between' (keeps the
 *  value shape unambiguous; the Record Filter Engine accepts either). Field
 *  keys are the vendor_payment resolver's whitelist (vendorpayment/resolver.go
 *  systemFields); anything outside it comes back as a 400 InvalidFilterError,
 *  which the table surfaces rather than swallowing. */
export function toFilterClauses(f: VendorPaymentFilterState): FilterClause[] {
  const clauses: FilterClause[] = [];
  if (f.recordNumber) clauses.push({ field: 'record_number', op: 'contains', value: f.recordNumber });
  if (f.referenceNumber) clauses.push({ field: 'reference_number', op: 'contains', value: f.referenceNumber });
  if (f.paymentDateFrom) clauses.push({ field: 'payment_date', op: 'gte', value: f.paymentDateFrom });
  if (f.paymentDateTo) clauses.push({ field: 'payment_date', op: 'lte', value: f.paymentDateTo });
  if (f.scheduledDateFrom) clauses.push({ field: 'scheduled_date', op: 'gte', value: f.scheduledDateFrom });
  if (f.scheduledDateTo) clauses.push({ field: 'scheduled_date', op: 'lte', value: f.scheduledDateTo });
  if (f.amountMin) clauses.push({ field: 'amount', op: 'gte', value: Number(f.amountMin) });
  if (f.amountMax) clauses.push({ field: 'amount', op: 'lte', value: Number(f.amountMax) });
  if (f.unappliedMin) clauses.push({ field: 'unapplied_amount', op: 'gte', value: Number(f.unappliedMin) });
  if (f.unappliedMax) clauses.push({ field: 'unapplied_amount', op: 'lte', value: Number(f.unappliedMax) });
  if (f.approvalStatus) clauses.push({ field: 'approval_status', op: 'eq', value: f.approvalStatus });
  if (f.methodId) clauses.push({ field: 'method_id', op: 'eq', value: f.methodId });
  if (f.ownerId) clauses.push({ field: 'owner_id', op: 'eq', value: f.ownerId });
  for (const [key, val] of Object.entries(f.customFields)) {
    if (val) clauses.push({ field: `cf:${key}`, op: 'contains', value: val });
  }
  return clauses;
}
