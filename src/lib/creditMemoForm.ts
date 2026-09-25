// Credit Memo form field definitions & payload mappers — mirrors
// invoiceForm.ts's shape, adapted to the Credit Memo backend contract
// (types/creditMemo.ts). Field keys are UI-facing (mapped to the create/
// update payload via toCreatePayload/toUpdatePayload, not sent to the
// backend verbatim).

import type { CrmLookups } from '@/services/lookupService';
import type { CreditMemo, CreditMemoCreatePayload, CreditMemoUpdatePayload } from '@/types/creditMemo';

/** Cents — the precision of every money field. */
export const MONEY_STEP = 0.01;
/** The backend stores the sales tax rate to 4 decimal places (DECIMAL(6,4)), so
 *  a real rate such as 8.875% must be enterable. */
export const PERCENT_STEP = 0.0001;

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface CreditMemoFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'email' | 'tel' | 'number' | 'date' | 'readonly';
  required?: boolean;
  options?: string[];
  /** When set, options are sourced from CrmLookups[lookupKey] (id/name pairs)
   *  instead of the static `options` string list. */
  lookupKey?: keyof CrmLookups;
  /** For a lookupKey field whose rows carry a `countryId` (states): only show
   *  options where countryId matches the value of this other field. */
  dependsOn?: string;
  placeholder?: string;
  /** Span two grid columns */
  colSpan2?: boolean;
  /** Span all grid columns */
  colSpanFull?: boolean;
  /** Textarea row count (only used when type === 'textarea') */
  rows?: number;
  /** Native min/max/step for type: 'number' fields. Without a step a browser
   *  only accepts whole numbers counted from `min` (so an Amount of 100 with
   *  min 0.01 fails as 'nearest valid values 99.01 and 100.01'). */
  min?: number;
  max?: number;
  step?: number;
  /** When true, field is disabled while the credit memo is not editable
   *  (Edit page only — money fields lock once status leaves DRFT). */
  moneyField?: boolean;
}

// ── Form section field definitions ───────────────────────────────────────────

export const PRIMARY_INFO_FIELDS: CreditMemoFormField[] = [
  {
    key: 'credit_memo_status',
    label: 'Credit Memo Status',
    type: 'readonly',
    placeholder: 'Draft',
  },
  {
    key: 'credit_memo_doc_num',
    label: 'Credit Memo #',
    type: 'readonly',
    placeholder: 'Auto-generated',
  },
  {
    key: 'reference_number',
    label: 'Reference #',
    type: 'text',
    placeholder: 'Enter a reference number',
  },
  {
    key: 'credit_memo_date',
    label: 'Credit Memo Date',
    type: 'date',
    required: true,
  },
  {
    key: 'currency_id',
    label: 'Currency',
    type: 'select',
    lookupKey: 'currencies',
    moneyField: true,
  },
  {
    key: 'amount',
    label: 'Amount',
    type: 'number',
    required: true,
    placeholder: '0.00',
    min: 0.01,
    step: MONEY_STEP,
    moneyField: true,
  },
  {
    key: 'reason',
    label: 'Reason',
    type: 'text',
    placeholder: 'Reason for this credit memo',
  },
  {
    key: 'sales_tax_pct',
    label: 'Sales Tax %',
    type: 'number',
    placeholder: '0.00',
    min: 0,
    max: 100,
    step: PERCENT_STEP,
    moneyField: true,
  },
  {
    key: 'adjustment',
    label: 'Adjustment',
    type: 'number',
    placeholder: '0.00',
    step: MONEY_STEP,
    moneyField: true,
  },
  {
    key: 'memo',
    label: 'Memo',
    type: 'textarea',
    placeholder: 'Notes related to this credit memo…',
    colSpanFull: true,
  },
  {
    key: 'notes',
    label: 'Notes',
    type: 'textarea',
    placeholder: 'Additional notes…',
    colSpanFull: true,
  },
  {
    key: 'internal_notes',
    label: 'Internal Notes',
    type: 'textarea',
    placeholder: 'Internal-only notes…',
    colSpanFull: true,
  },
];

// bill_customer/bill_customer_uuid are handled by a dedicated customer picker
// (CustomerPicker), not this grid. Unlike Invoice, Credit Memo has no
// shipping address — billing only.
export const BILLING_FIELDS: CreditMemoFormField[] = [
  {
    key: 'bill_attn',
    label: 'Attn:',
    type: 'text',
    placeholder: 'Authorized contact person',
  },
  {
    key: 'bill_address1',
    label: 'Address Line 1',
    type: 'textarea',
    rows: 2,
    colSpan2: true,
    required: true,
    placeholder: '123 Main Street',
  },
  {
    key: 'bill_address2',
    label: 'Address Line 2',
    type: 'textarea',
    rows: 2,
    colSpan2: true,
    placeholder: 'Apt, suite, floor, etc.',
  },
  {
    key: 'bill_suite',
    label: 'Suite / Unit #',
    type: 'text',
    placeholder: 'Suite 100',
  },
  { key: 'bill_city', label: 'City', type: 'text', required: true, placeholder: 'City' },
  { key: 'bill_country', label: 'Country', type: 'select', required: true, lookupKey: 'countries' },
  { key: 'bill_state', label: 'State', type: 'select', required: true, lookupKey: 'states', dependsOn: 'bill_country' },
  {
    key: 'bill_zip',
    label: 'Zip / Postal Code',
    type: 'text',
    required: true,
    placeholder: '12345',
  },
  {
    key: 'bill_phone',
    label: 'Phone',
    type: 'tel',
    placeholder: '+1 (555) 000-0000',
  },
  {
    key: 'bill_fax',
    label: 'Fax',
    type: 'tel',
    placeholder: '+1 (555) 000-0000',
  },
  {
    key: 'bill_email',
    label: 'Email',
    type: 'email',
    placeholder: 'billing@company.com',
  },
];

// ── Status catalog (fixed, branching state machine) ───────────────────────────

export const CREDIT_MEMO_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'APPV', label: 'Approved' },
  { code: 'APPL', label: 'Applied' },
  { code: 'VOID', label: 'Void' },
];

export const CREDIT_MEMO_STATUS_COLORS: Record<string, string> = {
  Draft: '#a8a29e',
  Approved: '#3b82f6',
  Applied: '#10b981',
  Void: '#78716c',
};

/** Legal next-moves from a given status code. APPL is intentionally absent
 *  as a target anywhere — it's reached automatically once `apply` fully
 *  absorbs the unapplied balance, never picked directly. The backend remains
 *  the source of truth; an illegal pick is rejected with 409. */
export const CREDIT_MEMO_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRFT: ['APPV', 'VOID'],
  APPV: ['VOID'],
  APPL: [],
  VOID: [],
};

/** Statuses that are read-only in the View page — no further edits,
 *  applying, or unapplying once reached. */
export const CREDIT_MEMO_READONLY_STATUSES = new Set(['APPL', 'VOID']);

/** Editable-fields rule (spec): amount, sales tax, and adjustment are only
 *  editable while the credit memo is still DRFT — every other status
 *  disables just those "money fields" rather than locking the whole form. */
export const CREDIT_MEMO_DRAFT_STATUS = 'DRFT';

// ── Form defaults ─────────────────────────────────────────────────────────────

export function creditMemoDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    credit_memo_date: today,
    credit_memo_status: 'Draft',
    sales_tax_pct: '0',
  };
}

// ── Payload mapping (UI form state -> backend contracts) ─────────────────────

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

const CENTS_PER_UNIT = 100;
const PERCENT_DIVISOR = 100;

function round2(value: number): number {
  return Math.round(value * CENTS_PER_UNIT) / CENTS_PER_UNIT;
}

/** The credit memo's money from its one Amount — the same arithmetic the
 *  backend stores (creditmemo.ComputeAmountLine + ComputeHeader): the amount
 *  is the subtotal, sales tax is charged on top of it, then the adjustment.
 *  A blank or non-numeric amount counts as 0 while the user is still typing. */
export function creditMemoTotals(
  amount: unknown,
  taxPercent: number,
  adjustment: number,
): { subtotal: number; taxTotal: number; total: number } {
  const subtotal = round2(toNum(amount));
  const taxTotal = round2(subtotal * (taxPercent / PERCENT_DIVISOR));
  return { subtotal, taxTotal, total: round2(subtotal + taxTotal + adjustment) };
}

function billingFromData(data: Record<string, unknown>) {
  return {
    attention: toStr(data.bill_attn),
    addrLine1: toStr(data.bill_address1),
    addrLine2: toStr(data.bill_address2),
    suiteUnit: toStr(data.bill_suite),
    city: toStr(data.bill_city),
    stateId: toIntOrNull(data.bill_state),
    countryId: toIntOrNull(data.bill_country),
    zip: toStr(data.bill_zip),
    phone: toStr(data.bill_phone),
    fax: toStr(data.bill_fax),
    email: toStr(data.bill_email),
  };
}

/** Maps the AddCreditMemoPage form state to the backend's
 *  `CreditMemoCreatePayload`. `customerUuid`/`invoiceUuid`/`salesOrderUuid`/
 *  `sourcePaymentUuid` come from their respective pickers / the payment
 *  handoff. Status is intentionally omitted: every new credit memo starts at
 *  DRFT server-side. Applications are never sent here — they're created later
 *  via /apply. */
export function toCreatePayload(
  data: Record<string, unknown>,
  customFields: Record<string, unknown> = {},
): CreditMemoCreatePayload {
  return {
    customerUuid: toStr(data.customer_uuid),
    invoiceUuid: toStr(data.invoice_uuid) || undefined,
    salesOrderUuid: toStr(data.sales_order_uuid) || undefined,
    sourcePaymentUuid: toStr(data.source_payment_uuid) || undefined,
    amount: toNum(data.amount),
    currencyId: toIntOrNull(data.currency_id),
    referenceNumber: toStr(data.reference_number),
    creditMemoDate: toStr(data.credit_memo_date),
    reason: toStr(data.reason),
    salesTaxPercent: toNum(data.sales_tax_pct),
    adjustment: toNum(data.adjustment),
    memo: toStr(data.memo),
    notes: toStr(data.notes),
    internalNotes: toStr(data.internal_notes),
    billing: billingFromData(data),
    customFields,
  };
}

/** Maps the EditCreditMemoPage form state to the backend's
 *  `CreditMemoUpdatePayload` — no customer/invoice/salesOrder/sourcePayment
 *  (immutable post-creation). `recordVersion` must be the version last read
 *  from the server, for optimistic locking.
 *
 *  `amount` is only sent when it differs from `originalAmount`: the backend
 *  replaces any legacy line items with a single amount when it receives one, so
 *  an untouched amount must not be resent. */
export function toUpdatePayload(
  data: Record<string, unknown>,
  recordVersion: number,
  customFields: Record<string, unknown> = {},
  originalAmount?: string,
): CreditMemoUpdatePayload {
  const amountEdited = originalAmount !== undefined && toNum(data.amount) !== toNum(originalAmount);
  return {
    referenceNumber: toStr(data.reference_number),
    creditMemoDate: toStr(data.credit_memo_date),
    currencyId: toIntOrNull(data.currency_id),
    reason: toStr(data.reason),
    salesTaxPercent: toNum(data.sales_tax_pct),
    adjustment: toNum(data.adjustment),
    memo: toStr(data.memo),
    notes: toStr(data.notes),
    internalNotes: toStr(data.internal_notes),
    billing: billingFromData(data),
    customFields,
    ...(amountEdited ? { amount: toNum(data.amount) } : {}),
    recordVersion,
  };
}

/** id-or-empty for a lookupKey <select>'s bound value: null/undefined must
 *  render as "— Select —" (empty string), never "0" or "null". */
function idOrEmpty(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

/** Maps a loaded CreditMemo (GET response) back to the Edit form's state —
 *  the inverse of toUpdatePayload. Customer/invoice/salesOrder are returned
 *  separately since they're driven by their own picker state / read-only
 *  display, not plain form fields. */
export function fromCreditMemo(creditMemo: CreditMemo): {
  data: Record<string, unknown>;
  customer: { id: string; name: string };
  invoice: { id: string; number: string } | null;
  salesOrder: { id: string; number: string } | null;
  sourcePayment: { id: string; number: string } | null;
  customFieldValues: Record<string, unknown>;
} {
  // Older/legacy records can round-trip without a `billing` block at all —
  // fall back to an empty snapshot rather than crash the edit form.
  const billing = creditMemo.billing ?? {};

  const data: Record<string, unknown> = {
    credit_memo_status: creditMemo.status,
    credit_memo_doc_num: creditMemo.creditMemoNumber,
    reference_number: creditMemo.referenceNumber ?? '',
    credit_memo_date: creditMemo.creditMemoDate,
    // A legacy memo's lines are not editable any more; its net subtotal stands
    // in as the amount. An amount-only memo has no discount, so this is its amount.
    amount: (creditMemo.subtotal - creditMemo.discountTotal).toFixed(2),
    currency_id: idOrEmpty(creditMemo.currencyId),
    reason: creditMemo.reason ?? '',
    sales_tax_pct: String(creditMemo.salesTaxPercent ?? 0),
    adjustment: String(creditMemo.adjustment ?? 0),
    memo: creditMemo.memo ?? '',
    notes: creditMemo.notes ?? '',
    internal_notes: creditMemo.internalNotes ?? '',
    bill_attn: billing.attention ?? '',
    bill_address1: billing.addrLine1 ?? '',
    bill_address2: billing.addrLine2 ?? '',
    bill_suite: billing.suiteUnit ?? '',
    bill_city: billing.city ?? '',
    bill_state: idOrEmpty(billing.stateId),
    bill_country: idOrEmpty(billing.countryId),
    bill_zip: billing.zip ?? '',
    bill_phone: billing.phone ?? '',
    bill_fax: billing.fax ?? '',
    bill_email: billing.email ?? '',
  };

  return {
    data,
    customer: { id: creditMemo.customer.id, name: creditMemo.customer.name },
    invoice: creditMemo.invoice ? { id: creditMemo.invoice.id, number: creditMemo.invoice.number } : null,
    salesOrder: creditMemo.salesOrder ? { id: creditMemo.salesOrder.id, number: creditMemo.salesOrder.number } : null,
    sourcePayment: creditMemo.sourcePayment ? { id: creditMemo.sourcePayment.id, number: creditMemo.sourcePayment.number } : null,
    customFieldValues: creditMemo.customFields ?? {},
  };
}
