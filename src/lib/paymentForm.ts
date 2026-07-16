// Payment form field definitions & payload mappers — mirrors invoiceForm.ts's
// shape, adapted to the Payment backend contract (types/payment.ts).

import type { CrmLookups } from '@/services/lookupService';
import type { Payment, PaymentCreatePayload, PaymentUpdatePayload } from '@/types/payment';
import { PAYMENT_METHODS } from './paymentMethods';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface PaymentFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'readonly';
  required?: boolean;
  /** Static options for a plain select — value === label. */
  options?: string[];
  /** id/name options for a select bound to a numeric id (e.g. payment method). */
  idOptions?: { id: number; name: string }[];
  /** Sources options from CrmLookups[lookupKey] (id/name pairs) at render time. */
  lookupKey?: keyof CrmLookups;
  placeholder?: string;
  colSpan2?: boolean;
  colSpanFull?: boolean;
  rows?: number;
}

// ── Form section field definitions ───────────────────────────────────────────

/** Create-page fields. Status and payment # are server-assigned (no picker on
 *  create — every new payment starts PEND); customer is handled by
 *  CustomerPicker, not this grid. */
export const PRIMARY_INFO_FIELDS: PaymentFormField[] = [
  { key: 'payment_method', label: 'Payment Method', type: 'select', required: true, idOptions: PAYMENT_METHODS },
  { key: 'payment_date', label: 'Payment Date', type: 'date', required: true },
  { key: 'reference_num', label: 'Reference / Check #', type: 'text', placeholder: 'Enter reference or check number' },
  { key: 'amount', label: 'Amount', type: 'number', required: true, placeholder: '0.00' },
  { key: 'currency_id', label: 'Currency', type: 'select', lookupKey: 'currencies' },
  { key: 'memo', label: 'Memo', type: 'textarea', placeholder: 'Notes related to this payment…', colSpanFull: true },
  { key: 'internal_notes', label: 'Internal Notes', type: 'textarea', placeholder: 'Internal-only notes…', colSpanFull: true },
];

/** Edit-page fields — excludes `amount` (immutable post-creation, backend
 *  AD-10) and the customer (fixed after creation, shown read-only instead). */
export const EDIT_FIELDS: PaymentFormField[] = PRIMARY_INFO_FIELDS.filter((f) => f.key !== 'amount');

// ── Status catalog (backend spec §7 — fixed, branching state machine) ────────

export const PAYMENT_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'PEND', label: 'Pending' },
  { code: 'APPV', label: 'Approved' },
  { code: 'DEPO', label: 'Deposited' },
  { code: 'VOID', label: 'Void' },
];

export const PAYMENT_STATUS_COLORS: Record<string, string> = {
  Pending: '#f59e0b',
  Approved: '#3b82f6',
  Deposited: '#10b981',
  Void: '#78716c',
};

/** Legal next-moves from a given status code (backend spec §7's
 *  allowedPaymentTransitions) — drives which options PaymentStatusControl
 *  offers. The backend remains authoritative; an illegal pick is rejected
 *  with 409. */
export const PAYMENT_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PEND: ['APPV', 'VOID'],
  APPV: ['DEPO', 'VOID'],
  DEPO: [],
  VOID: [],
};

/** Statuses that block apply/unapply (backend AD-7: applying is allowed at
 *  PEND/APPV/DEPO, blocked only at VOID — looser than Invoice's payable-
 *  status gate since this module records money in, not out). */
export const PAYMENT_BLOCKS_APPLY = new Set(['VOID']);

// ── Form defaults ─────────────────────────────────────────────────────────────

export function paymentDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    payment_date: today,
  };
}

// ── Date handling ─────────────────────────────────────────────────────────────
//
// payment.CreatePaymentInput/UpdatePaymentInput's PaymentDate field is a Go
// *time.Time (unlike Invoice's plain "yyyy-mm-dd" string field) — its default
// JSON unmarshaling requires a full RFC3339 timestamp, so a bare
// `<input type="date">` value like "2026-07-15" fails to decode server-side
// (json.Decode returns an error, surfaced as a 400 "Invalid request body").
// toRFC3339OrUndefined appends a UTC-midnight time component before sending;
// fromRFC3339DateOnly strips it back off when loading a payment into the form.

export function toRFC3339OrUndefined(dateStr: string): string | undefined {
  return dateStr ? `${dateStr}T00:00:00Z` : undefined;
}

export function fromRFC3339DateOnly(iso: string | undefined): string {
  return iso ? iso.slice(0, 10) : '';
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

function toIntOrZero(v: unknown): number {
  return toIntOrNull(v) ?? 0;
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/** Maps the AddPaymentPage form state to the backend's `PaymentCreatePayload`,
 *  minus `applications` (tracked separately by the page as a local array and
 *  spread in at submit time — see AddPaymentPage). */
export function toCreatePayload(
  data: Record<string, unknown>,
  customerUuid: string,
): Omit<PaymentCreatePayload, 'applications'> {
  return {
    customerUuid,
    methodId: toIntOrZero(data.payment_method),
    referenceNumber: toStr(data.reference_num),
    paymentDate: toRFC3339OrUndefined(toStr(data.payment_date)),
    currencyId: toIntOrNull(data.currency_id),
    amount: toNum(data.amount),
    memo: toStr(data.memo),
    internalNotes: toStr(data.internal_notes),
    customFields: {},
  };
}

/** Maps the EditPaymentPage form state to the backend's `PaymentUpdatePayload`
 *  (no amount — immutable post-creation). */
export function toUpdatePayload(data: Record<string, unknown>): PaymentUpdatePayload {
  return {
    methodId: toIntOrZero(data.payment_method),
    referenceNumber: toStr(data.reference_num),
    paymentDate: toRFC3339OrUndefined(toStr(data.payment_date)),
    currencyId: toIntOrNull(data.currency_id),
    memo: toStr(data.memo),
    internalNotes: toStr(data.internal_notes),
    customFields: {},
  };
}

/** id-or-empty for a lookupKey/idOptions <select>'s bound value: null/
 *  undefined must render as "— Select —" (empty string), never "0" or
 *  "null". */
function idOrEmpty(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

/** Maps a loaded Payment (GET response) back to the Edit form's state — the
 *  inverse of toUpdatePayload. Customer is returned separately since Edit
 *  displays it read-only, not through this field grid. */
export function fromPayment(payment: Payment): {
  data: Record<string, unknown>;
  customer: { id: string; name: string };
} {
  const data: Record<string, unknown> = {
    payment_method: String(payment.methodId),
    reference_num: payment.referenceNumber ?? '',
    payment_date: fromRFC3339DateOnly(payment.paymentDate),
    currency_id: idOrEmpty(payment.currencyId),
    memo: payment.memo ?? '',
    internal_notes: payment.internalNotes ?? '',
  };
  return { data, customer: { id: payment.customer.id, name: payment.customer.name } };
}
