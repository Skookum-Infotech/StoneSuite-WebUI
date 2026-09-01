// Refund form field definitions & payload mappers — mirrors paymentForm.ts's
// shape, adapted to the Refund backend contract (types/refund.ts).

import type { CrmLookups } from '@/services/lookupService';
import type { Refund, RefundCreatePayload, RefundUpdatePayload, RefundApplication } from '@/types/refund';
import { PAYMENT_METHODS } from './paymentMethods';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface RefundFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'readonly';
  required?: boolean;
  /** Static options for a plain select — value === label. */
  options?: string[];
  /** id/name options for a select bound to a numeric id (e.g. refund method). */
  idOptions?: { id: number; name: string }[];
  /** Sources options from CrmLookups[lookupKey] (id/name pairs) at render time. */
  lookupKey?: keyof CrmLookups;
  placeholder?: string;
  colSpan2?: boolean;
  colSpanFull?: boolean;
  rows?: number;
}

// ── Form section field definitions ───────────────────────────────────────────

/** Create-page fields. Status and refund # are server-assigned (no picker on
 *  create — every new refund starts PEND); customer is handled by
 *  CustomerPicker, not this grid.
 *
 *  `refund_method` reuses lkp_payment_method as-is — the refund module records
 *  *how the money went back* with the same Check/Cash/CC/ACH/Wire/Other list
 *  the payment module records how it came in (spec §1's reuse table). */
export const PRIMARY_INFO_FIELDS: RefundFormField[] = [
  { key: 'refund_method', label: 'Refund Method', type: 'select', required: true, idOptions: PAYMENT_METHODS },
  { key: 'refund_date', label: 'Refund Date', type: 'date', required: true },
  { key: 'reference_num', label: 'Reference / Check #', type: 'text', placeholder: 'Enter reference or check number' },
  { key: 'amount', label: 'Amount', type: 'number', required: true, placeholder: '0.00' },
  { key: 'currency_id', label: 'Currency', type: 'select', lookupKey: 'currencies' },
  { key: 'reason', label: 'Reason', type: 'text', placeholder: 'Why is this refund being issued?', colSpan2: true },
  { key: 'memo', label: 'Memo', type: 'textarea', placeholder: 'Notes related to this refund…', colSpanFull: true },
  { key: 'internal_notes', label: 'Internal Notes', type: 'textarea', placeholder: 'Internal-only notes…', colSpanFull: true },
];

/** Edit-page fields — excludes `amount` (immutable post-creation, backend
 *  AD-8) and the customer (fixed after creation, shown read-only instead). */
export const EDIT_FIELDS: RefundFormField[] = PRIMARY_INFO_FIELDS.filter((f) => f.key !== 'amount');

// ── Status catalog (backend spec §7 — fixed, branching state machine) ────────

export const REFUND_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'PEND', label: 'Pending' },
  { code: 'APPV', label: 'Approved' },
  { code: 'SENT', label: 'Sent' },
  { code: 'VOID', label: 'Void' },
];

export const REFUND_STATUS_COLORS: Record<string, string> = {
  Pending: '#f59e0b',
  Approved: '#3b82f6',
  Sent: '#10b981',
  Void: '#78716c',
};

/** Legal next-moves from a given status code (backend spec §7's
 *  allowedTransitions) — drives which options RefundStatusControl offers. The
 *  backend remains authoritative; an illegal pick is rejected with 409.
 *
 *  Note SENT has no exits: once the money is physically back with the
 *  customer, the record is terminal — reversing it is a new refund's problem,
 *  not a void (AD-3). */
export const REFUND_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PEND: ['APPV', 'VOID'],
  APPV: ['SENT', 'VOID'],
  SENT: [],
  VOID: [],
};

/** Which RBAC action gates a move to `toCode`.
 *
 *  Approving is what authorizes a refund to draw down real money, so the
 *  PEND->APPV step is a *separate capability* from every other transition
 *  (spec AD-4; server-side twin: actionForTransition in
 *  controllers/refund_transition.go). This is also how "a creator can't
 *  approve their own refund" is enforced: not by an identity check on the
 *  record, but by role design — the `customer_support` role holds
 *  refund:{create,read,update}@own and deliberately no `approve` (spec §12),
 *  so a support user can draft a refund but cannot authorize it. A user who
 *  *does* hold refund:approve may approve refunds they created. */
export function transitionPermission(toCode: string): 'approve' | 'transition' {
  return toCode === 'APPV' ? 'approve' : 'transition';
}

/** Whether a refund is currently blocked on AD-8 approval sign-off -- gated
 *  at PEND until every configured approver (or a super admin override) has
 *  signed off via refundService.approve. Distinct from refund:approve RBAC
 *  permission above: that's a role-level capability check ("can this person
 *  ever approve"), this is a record-level one ("does *this* refund's current
 *  status have a quorum still outstanding"). Prefers the live `gated` flag
 *  from GET over the stored approvalStatus column, which goes stale the
 *  moment an admin edits the approver list. List rows don't carry `gated`
 *  so they fall back to the stored flag. */
export function needsApproval(refund: Pick<Refund, 'approvalStatus'> & { gated?: boolean }): boolean {
  return refund.gated ?? refund.approvalStatus === 'pending';
}

/** Statuses at which apply/unapply is blocked (backend AD-5: applying
 *  requires the refund be APPV — money may only be drawn once approved).
 *  Stricter than Payment's gate, which blocks only at VOID, because a
 *  payment's money has already physically arrived while a refund's has not
 *  yet left. */
export const REFUND_APPLY_STATUS = 'APPV';

export function canApply(statusCode: string): boolean {
  return statusCode === REFUND_APPLY_STATUS;
}

/** Why apply is unavailable, or null when it is available — drives the
 *  disabled button's tooltip so the reason is never silently swallowed. */
export function applyBlockedReason(statusCode: string, unappliedAmount: number): string | null {
  if (!canApply(statusCode)) {
    return statusCode === 'PEND'
      ? 'Approve this refund before drawing money from a source.'
      : 'Only an approved refund can be applied to a source.';
  }
  if (unappliedAmount <= 0) return 'No unapplied balance remaining.';
  return null;
}

// ── Application ledger helpers ───────────────────────────────────────────────

export type RefundSourceKind = 'payment' | 'credit_memo';

export interface RefundApplicationSource {
  kind: RefundSourceKind;
  id: string;
  number: string;
}

/** Narrows one dual-source application row to whichever source it actually
 *  draws from. The backend guarantees exactly one of the two id fields is set
 *  (the chk_refund_app_xor_source DB CHECK), so the null return is
 *  unreachable in practice — it exists so callers handle a contract violation
 *  by skipping the row rather than rendering "undefined". */
export function refundApplicationSource(app: RefundApplication): RefundApplicationSource | null {
  if (app.paymentId) {
    return { kind: 'payment', id: app.paymentId, number: app.paymentNumber ?? '—' };
  }
  if (app.creditMemoId) {
    return { kind: 'credit_memo', id: app.creditMemoId, number: app.creditMemoNumber ?? '—' };
  }
  return null;
}

/** The one-of body shape refundService.apply/unapply expect. */
export function sourceRequestBody(
  source: Pick<RefundApplicationSource, 'kind' | 'id'>,
): { paymentUuid: string } | { creditMemoUuid: string } {
  return source.kind === 'payment' ? { paymentUuid: source.id } : { creditMemoUuid: source.id };
}

export const SOURCE_KIND_LABELS: Record<RefundSourceKind, string> = {
  payment: 'Payment',
  credit_memo: 'Credit Memo',
};

/** Detail route for a source document, for the ledger's drill-through links. */
export function sourceDetailPath(source: Pick<RefundApplicationSource, 'kind' | 'id'>): string {
  return source.kind === 'payment' ? `/sales/payment/${source.id}` : `/sales/credit_memo/${source.id}`;
}

// ── Form defaults ─────────────────────────────────────────────────────────────

export function refundDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    refund_date: today,
  };
}

// ── Date handling ─────────────────────────────────────────────────────────────
//
// refund.CreateRefundInput/UpdateRefundInput's RefundDate field is a Go
// *time.Time (same as Payment's PaymentDate) — its default JSON unmarshaling
// requires a full RFC3339 timestamp, so a bare `<input type="date">` value
// like "2026-07-16" fails to decode server-side (json.Decode returns an error,
// surfaced as a 400 "Invalid request body"). toRFC3339OrUndefined appends a
// UTC-midnight time component before sending; fromRFC3339DateOnly strips it
// back off when loading a refund into the form.

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

/** Maps the AddRefundPage form state to the backend's `RefundCreatePayload`.
 *
 *  `lineage` is optional and carries no money (AD-12) — unlike
 *  paymentForm.toCreatePayload's omitted `applications`, there is no inline
 *  application to spread in at submit time: a refund starts PEND and apply
 *  requires APPV, so the ledger is always composed after create (spec §11). */
export function toCreatePayload(
  data: Record<string, unknown>,
  customerUuid: string,
  lineage: { paymentUuid?: string; creditMemoUuid?: string; invoiceUuid?: string } = {},
  customFields: Record<string, unknown> = {},
): RefundCreatePayload {
  return {
    customerUuid,
    methodId: toIntOrZero(data.refund_method),
    referenceNumber: toStr(data.reference_num),
    refundDate: toRFC3339OrUndefined(toStr(data.refund_date)),
    currencyId: toIntOrNull(data.currency_id),
    amount: toNum(data.amount),
    reason: toStr(data.reason),
    memo: toStr(data.memo),
    internalNotes: toStr(data.internal_notes),
    customFields,
    ...(lineage.paymentUuid ? { paymentUuid: lineage.paymentUuid } : {}),
    ...(lineage.creditMemoUuid ? { creditMemoUuid: lineage.creditMemoUuid } : {}),
    ...(lineage.invoiceUuid ? { invoiceUuid: lineage.invoiceUuid } : {}),
  };
}

/** Maps the EditRefundPage form state to the backend's `RefundUpdatePayload`
 *  (no amount, no customer, no lineage — all immutable post-creation, AD-8). */
export function toUpdatePayload(
  data: Record<string, unknown>,
  customFields: Record<string, unknown> = {},
): RefundUpdatePayload {
  return {
    methodId: toIntOrZero(data.refund_method),
    referenceNumber: toStr(data.reference_num),
    refundDate: toRFC3339OrUndefined(toStr(data.refund_date)),
    currencyId: toIntOrNull(data.currency_id),
    reason: toStr(data.reason),
    memo: toStr(data.memo),
    internalNotes: toStr(data.internal_notes),
    customFields,
  };
}

/** id-or-empty for a lookupKey/idOptions <select>'s bound value: null/
 *  undefined must render as "— Select —" (empty string), never "0" or
 *  "null". */
function idOrEmpty(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

/** Maps a loaded Refund (GET response) back to the Edit form's state — the
 *  inverse of toUpdatePayload. Customer is returned separately since Edit
 *  displays it read-only, not through this field grid. */
export function fromRefund(refund: Refund): {
  data: Record<string, unknown>;
  customer: { id: string; name: string };
  customFieldValues: Record<string, unknown>;
} {
  const data: Record<string, unknown> = {
    refund_method: String(refund.methodId),
    reference_num: refund.referenceNumber ?? '',
    refund_date: fromRFC3339DateOnly(refund.refundDate),
    currency_id: idOrEmpty(refund.currencyId),
    reason: refund.reason ?? '',
    memo: refund.memo ?? '',
    internal_notes: refund.internalNotes ?? '',
  };
  return {
    data,
    customer: { id: refund.customer.id, name: refund.customer.name },
    customFieldValues: refund.customFields ?? {},
  };
}
