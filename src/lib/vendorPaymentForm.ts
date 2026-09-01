// Vendor Payment form field definitions & payload mappers — the accounts-
// payable mirror of lib/paymentForm.ts, adapted to the Vendor Payment backend
// contract (types/vendorPayment.ts). Unlike Vendor Bill there are no line
// items: a payment is a single money amount spread across bills through the
// application ledger.

import type { CrmLookups } from '@/services/lookupService';
import type { FieldDefinition } from '@/types/tenant';
import type {
  VendorPayment, CreateVendorPaymentPayload, UpdateVendorPaymentPayload,
} from '@/types/vendorPayment';
import { PAYMENT_METHODS } from './paymentMethods';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface VendorPaymentFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'readonly';
  required?: boolean;
  /** id/name options for a select bound to a numeric id (e.g. payment method). */
  idOptions?: { id: number; name: string }[];
  /** Sources options from CrmLookups[lookupKey] (id/name pairs) at render time. */
  lookupKey?: keyof CrmLookups;
  placeholder?: string;
  colSpan2?: boolean;
  colSpanFull?: boolean;
  rows?: number;
  hint?: string;
}

// ── Form section field definitions ───────────────────────────────────────────

/** Create-page fields. Status and payment # are server-assigned (every new
 *  payment starts DRFT); the vendor is handled by VendorPicker, not this grid. */
export const PRIMARY_INFO_FIELDS: VendorPaymentFormField[] = [
  { key: 'payment_method', label: 'Payment Method', type: 'select', required: true, idOptions: PAYMENT_METHODS },
  { key: 'payment_date', label: 'Payment Date', type: 'date', required: true },
  { key: 'reference_num', label: 'Reference / Check #', type: 'text', placeholder: 'Enter reference or check number' },
  { key: 'amount', label: 'Amount', type: 'number', required: true, placeholder: '0.00' },
  {
    key: 'scheduled_date',
    label: 'Scheduled Date',
    type: 'date',
    hint: 'Required before this payment can be scheduled for dispatch.',
  },
  { key: 'currency_id', label: 'Currency', type: 'select', lookupKey: 'currencies' },
  { key: 'owner_employee', label: 'Owner', type: 'select', lookupKey: 'employees' },
  { key: 'memo', label: 'Memo', type: 'textarea', placeholder: 'Notes related to this payment…', colSpanFull: true },
  { key: 'internal_notes', label: 'Internal Notes', type: 'textarea', placeholder: 'Notes visible to your team only…', colSpanFull: true },
];

/** Edit-page fields — excludes `amount` (immutable post-creation, backend
 *  AD-12); the vendor is fixed at creation and shown read-only instead. */
export const EDIT_FIELDS: VendorPaymentFormField[] = PRIMARY_INFO_FIELDS.filter((f) => f.key !== 'amount');

// ── Status catalog (backend vendorpayment/transitions.go) ────────────────────

/** Every status code the VPAY state machine references. The backend
 *  (`vendorpayment.ValidateTransition`) is the source of truth for which moves
 *  are legal from a given status — this list only drives display labels.
 *
 *  Caveat carried over from the backend: schema.sql seeds VPAY with
 *  DRFT/SCHD (§5.1) on top of the record-type-16 block's PEND/APPV/SENT/VOID,
 *  so there is currently no `PAPV` row for VPAY even though the transition map
 *  routes through it. A "Submit for Approval" attempt therefore fails server-
 *  side with "Unknown target status: PAPV" until that seed is added — the UI
 *  surfaces that as a normal transition error rather than hiding the button,
 *  since the map (not the seed) is the module's stated contract. */
export const VP_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'PAPV', label: 'Pending Approval' },
  { code: 'APPV', label: 'Approved' },
  { code: 'SCHD', label: 'Scheduled' },
  { code: 'SENT', label: 'Sent' },
  { code: 'VOID', label: 'Void' },
];

/** Legal next-moves per status — mirrors vendorpayment/transitions.go's
 *  `allowedTransitions`. PAPV→APPV appears here for completeness but is
 *  rejected by the generic /transition endpoint (409 ErrApprovalRequired):
 *  the only path across that edge is the /approve sign-off, so
 *  VendorPaymentTransitionBar filters it out of the button row. */
export const VP_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRFT: ['PAPV', 'VOID'],
  PAPV: ['APPV', 'DRFT', 'VOID'],
  APPV: ['SCHD', 'SENT', 'VOID'],
  SCHD: ['SENT', 'VOID'],
  SENT: ['VOID'],
  VOID: [],
};

/** Transition targets the UI must never offer as a plain status button,
 *  keyed `${from}:${to}` — PAPV→APPV is approval-only (see above). */
export const VP_APPROVAL_ONLY_EDGES = new Set(['PAPV:APPV']);

/** Button label per (from, to) status-code pair — a plain `to`-keyed map can't
 *  distinguish contexts that share a target code (mirrors VB_TRANSITION_LABELS). */
export const VP_TRANSITION_LABELS: Record<string, string> = {
  'DRFT:PAPV': 'Submit for Approval',
  'DRFT:VOID': 'Void',
  'PAPV:DRFT': 'Recall to Draft',
  'PAPV:VOID': 'Void',
  'APPV:SCHD': 'Schedule Payment',
  'APPV:SENT': 'Mark Sent',
  'APPV:VOID': 'Void',
  'SCHD:SENT': 'Mark Sent',
  'SCHD:VOID': 'Void',
  'SENT:VOID': 'Void',
};

export function vpTransitionLabel(from: string, to: string): string {
  return VP_TRANSITION_LABELS[`${from}:${to}`] ?? to;
}

/** Human label for a status code (e.g. "SCHD" -> "Scheduled") — used by the
 *  transition confirmation dialog. Falls back to the raw code. */
export function vpStatusLabel(code: string): string {
  return VP_STATUS_CODES.find((s) => s.code === code)?.label ?? code;
}

/** The legal targets actually rendered as buttons: the transition map minus
 *  the approval-only edges the generic endpoint rejects. */
export function vpTransitionTargets(fromCode: string): string[] {
  return (VP_ALLOWED_TRANSITIONS[fromCode] ?? []).filter(
    (to) => !VP_APPROVAL_ONLY_EDGES.has(`${fromCode}:${to}`),
  );
}

/** AD-6 approval gate (vendorpayment/store_transition.go): once a status
 *  requires sign-off, every move away from it is blocked except the recall
 *  back to DRFT — until `approvalStatus` reaches "approved". Mirrors
 *  isVbTransitionBlocked. */
export function isVpTransitionBlocked(toCode: string, approvalStatus: string, gated?: boolean): boolean {
  return toCode !== 'DRFT' && (gated ?? approvalStatus === 'pending');
}

/** A move to SCHD is refused (400) unless the payment already carries a
 *  scheduled date — the transition endpoint doesn't accept one inline, so it
 *  has to be saved on the header first. */
export function isScheduleBlocked(toCode: string, scheduledDate?: string | null): boolean {
  return toCode === 'SCHD' && !scheduledDate;
}

/** Status badge color, keyed by status code (VPAY statuses are fixed/seeded,
 *  mirrors VB_STATUS_COLORS). */
export const VP_STATUS_COLORS: Record<string, string> = {
  DRFT: '#a8a29e',
  PAPV: '#f59e0b',
  APPV: '#3b82f6',
  SCHD: '#8b5cf6',
  SENT: '#10b981',
  VOID: '#78716c',
};

/** Statuses `vendorPaymentService.updateVendorPayment` accepts edits at
 *  (vendorpayment/store_update.go — DRFT/PAPV only). */
export const VP_EDITABLE_STATUSES = new Set(['DRFT', 'PAPV']);

/** Apply/unapply is blocked only on a voided payment (vendorpayment/apply.go)
 *  — looser than the bill's payable-status gate, which the server checks on
 *  the target bill instead. */
export const VP_BLOCKS_APPLY = new Set(['VOID']);

/** Bill statuses `Apply` will settle against (vendorbill.PayableStatuses) — a
 *  bill must be approved before money can be applied to it. Used to explain an
 *  empty bill picker rather than to gate the request. */
export const VP_PAYABLE_BILL_STATUSES = new Set(['APPV', 'PART', 'ODUE']);

// ── Form defaults ─────────────────────────────────────────────────────────────

export function vendorPaymentDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    payment_date: today,
  };
}

// ── Date handling ─────────────────────────────────────────────────────────────
//
// vendorpayment.CreateVendorPaymentInput/UpdateVendorPaymentInput's
// PaymentDate/ScheduledDate are Go *time.Time, whose default JSON unmarshaling
// requires a full RFC3339 timestamp — a bare `<input type="date">` value like
// "2026-08-12" fails to decode server-side (surfaced as 400 "Invalid request
// body"). Same trade-off paymentForm.ts documents: append UTC midnight on the
// way out, strip it on the way back in.

export function toRFC3339OrUndefined(dateStr: string): string | undefined {
  return dateStr ? `${dateStr}T00:00:00Z` : undefined;
}

export function fromRFC3339DateOnly(iso: string | null | undefined): string {
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

/** Maps the AddVendorPaymentPage form state to the backend's
 *  `CreateVendorPaymentPayload`, minus `applications` (tracked separately by
 *  the page as a local array and spread in at submit time). Status is
 *  intentionally omitted: every new payment starts at DRFT server-side. */
export function toCreatePayload(
  data: Record<string, unknown>,
  vendorUuid: string,
  customFields: Record<string, unknown> = {},
): Omit<CreateVendorPaymentPayload, 'applications'> {
  return {
    vendorUuid,
    methodId: toIntOrZero(data.payment_method),
    referenceNumber: toStr(data.reference_num),
    paymentDate: toRFC3339OrUndefined(toStr(data.payment_date)),
    scheduledDate: toRFC3339OrUndefined(toStr(data.scheduled_date)),
    currencyId: toIntOrNull(data.currency_id),
    ownerEmployeeId: toIntOrNull(data.owner_employee),
    amount: toNum(data.amount),
    memo: toStr(data.memo),
    internalNotes: toStr(data.internal_notes),
    customFields,
  };
}

/** Maps the EditVendorPaymentPage form state to the backend's
 *  `UpdateVendorPaymentPayload` (no amount — immutable post-creation). */
export function toUpdatePayload(
  data: Record<string, unknown>,
  customFields: Record<string, unknown> = {},
): UpdateVendorPaymentPayload {
  return {
    methodId: toIntOrZero(data.payment_method),
    referenceNumber: toStr(data.reference_num),
    paymentDate: toRFC3339OrUndefined(toStr(data.payment_date)),
    scheduledDate: toRFC3339OrUndefined(toStr(data.scheduled_date)),
    currencyId: toIntOrNull(data.currency_id),
    ownerEmployeeId: toIntOrNull(data.owner_employee),
    memo: toStr(data.memo),
    internalNotes: toStr(data.internal_notes),
    customFields,
  };
}

/** id-or-empty for a lookupKey/idOptions <select>'s bound value: null/
 *  undefined must render as "— Select —" (empty string), never "0" or "null". */
function idOrEmpty(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

/** Maps a loaded VendorPayment (GET response) back to the Edit form's state —
 *  the inverse of toUpdatePayload. The vendor is returned separately since
 *  Edit displays it read-only, not through this field grid. */
export function fromVendorPayment(payment: VendorPayment): {
  data: Record<string, unknown>;
  vendor: { id: string; name: string };
  customFieldValues: Record<string, unknown>;
} {
  const data: Record<string, unknown> = {
    payment_method: String(payment.methodId),
    reference_num: payment.referenceNumber ?? '',
    payment_date: fromRFC3339DateOnly(payment.paymentDate),
    scheduled_date: fromRFC3339DateOnly(payment.scheduledDate),
    currency_id: idOrEmpty(payment.currencyId),
    owner_employee: idOrEmpty(payment.ownerEmployeeId),
    memo: payment.memo ?? '',
    internal_notes: payment.internalNotes ?? '',
  };
  return {
    data,
    vendor: { id: payment.vendor.id, name: payment.vendor.name },
    customFieldValues: payment.customFields ?? {},
  };
}

/** Required-field check for the vendor_payment workflow's custom field
 *  definitions (rendered via DynamicFieldInput) — mirrors
 *  validateVendorBillCustomFields. */
export function validateVendorPaymentCustomFields(
  defs: FieldDefinition[],
  values: Record<string, unknown>,
): { key: string; label: string }[] {
  const errors: { key: string; label: string }[] = [];
  for (const def of defs) {
    if (!def.required) continue;
    const val = values[def.key];
    if (val === undefined || val === null || val === '') {
      errors.push({ key: def.key, label: def.label });
    }
  }
  return errors;
}
