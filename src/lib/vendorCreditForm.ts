// Vendor Credit form field definitions & payload mappers — the accounts-
// payable mirror of lib/creditMemoForm.ts, adapted to the header-only Vendor
// Credit backend contract (types/vendorCredit.ts, backend AD-1: no lines, no
// tax, no discount). Unlike Vendor Payment, `amount` stays editable on Update
// (backend §8) and dates are plain "yyyy-mm-dd" strings, not RFC3339.

import type { CrmLookups } from '@/services/lookupService';
import type { FieldDefinition } from '@/types/tenant';
import type {
  VendorCredit, CreateVendorCreditPayload, UpdateVendorCreditPayload,
} from '@/types/vendorCredit';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface VendorCreditFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'readonly';
  required?: boolean;
  lookupKey?: keyof CrmLookups;
  placeholder?: string;
  colSpan2?: boolean;
  colSpanFull?: boolean;
  rows?: number;
}

// ── Form section field definitions ───────────────────────────────────────────

/** Create-page fields. Status and credit # are server-assigned (every new
 *  credit starts DRFT); the vendor is handled by VendorPicker, not this grid. */
export const PRIMARY_INFO_FIELDS: VendorCreditFormField[] = [
  { key: 'credit_date', label: 'Credit Date', type: 'date', required: true },
  { key: 'reference_num', label: 'Reference #', type: 'text', placeholder: 'e.g. RMA-4471' },
  { key: 'amount', label: 'Amount', type: 'number', required: true, placeholder: '0.00' },
  { key: 'reason', label: 'Reason', type: 'text', placeholder: 'Why is this credit being issued?', colSpan2: true },
  { key: 'owner_employee', label: 'Owner', type: 'select', lookupKey: 'employees' },
  { key: 'memo', label: 'Memo', type: 'textarea', placeholder: 'Notes related to this credit…', colSpanFull: true },
  { key: 'internal_notes', label: 'Internal Notes', type: 'textarea', placeholder: 'Notes visible to your team only…', colSpanFull: true },
];

/** Edit-page fields are identical to create — unlike Vendor Payment, `amount`
 *  stays editable (accepted server-side only while the credit is DRFT). */
export const EDIT_FIELDS: VendorCreditFormField[] = PRIMARY_INFO_FIELDS;

// ── Status catalog (backend vendorcredit/transitions.go) ──────────────────────

export const VC_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'APPV', label: 'Approved' },
  { code: 'APPL', label: 'Applied' },
  { code: 'VOID', label: 'Void' },
];

/** Status badge color, keyed by status code (VCRD statuses are fixed/seeded,
 *  same set as Credit Memo — mirrors CREDIT_MEMO_STATUS_COLORS). */
export const VC_STATUS_COLORS: Record<string, string> = {
  DRFT: '#a8a29e',
  APPV: '#3b82f6',
  APPL: '#10b981',
  VOID: '#78716c',
};

/** Legal next-moves per status — mirrors vendorcredit/transitions.go's
 *  `allowedTransitions`. APPV->APPL appears in the backend map (Apply
 *  validates through it) but is never user-directed — it's reached
 *  automatically once `apply` fully consumes the credit's unapplied balance,
 *  and drops back to APPV the instant any of it is reversed — so it is
 *  omitted here; VC_ALLOWED_TRANSITIONS only lists moves a button should
 *  offer. */
export const VC_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRFT: ['APPV', 'VOID'],
  APPV: ['VOID'],
  APPL: [],
  VOID: [],
};

/** Button label per (from, to) status-code pair — a plain `to`-keyed map
 *  can't distinguish contexts that share a target code. "Void", not "Cancel"
 *  — every sibling AP/AR page (Vendor Bill, Vendor Payment, Credit Memo) uses
 *  this wording for the VOID transition, even though the backend design spec
 *  calls the operation "Cancel". */
export const VC_TRANSITION_LABELS: Record<string, string> = {
  'DRFT:APPV': 'Approve',
  'DRFT:VOID': 'Void',
  'APPV:VOID': 'Void',
};

export function vcTransitionLabel(from: string, to: string): string {
  return VC_TRANSITION_LABELS[`${from}:${to}`] ?? to;
}

/** Human label for a status code (e.g. "APPV" -> "Approved") — used by the
 *  transition confirmation dialog. Falls back to the raw code. */
export function vcStatusLabel(code: string): string {
  return VC_STATUS_CODES.find((s) => s.code === code)?.label ?? code;
}

/** Which RBAC action gates a move to `toCode` (backend AD-2: DRFT->APPV rides
 *  `vendor_credit:approve`; every other move rides `vendor_credit:transition`).
 *  Mirrors refundForm.ts's transitionPermission. This is a role-level
 *  capability check ("can this person ever approve") -- distinct from
 *  needsApproval below, which is a record-level AD-8 quorum check ("does
 *  *this* vendor credit's current status have sign-offs still outstanding"). */
export function transitionPermission(toCode: string): 'approve' | 'transition' {
  return toCode === 'APPV' ? 'approve' : 'transition';
}

/** Whether a vendor credit is currently blocked on AD-8 approval sign-off --
 *  gated at DRFT until every configured approver (or a super admin
 *  override) has signed off via vendorCreditService.approve. Once gated,
 *  even a vendor_credit:approve holder can't move DRFT->APPV directly
 *  through the generic /transition endpoint (409 ErrApprovalRequired); they
 *  go through the ApprovalBanner instead. Prefers the live `gated` flag
 *  from GET over the stored approvalStatus column, which goes stale the
 *  moment an admin edits the approver list. List rows don't carry `gated`
 *  so they fall back to the stored flag. */
export function needsApproval(vendorCredit: Pick<VendorCredit, 'approvalStatus'> & { gated?: boolean }): boolean {
  return vendorCredit.gated ?? vendorCredit.approvalStatus === 'pending';
}

// ── Status-driven gates ───────────────────────────────────────────────────────

/** Statuses `vendorCreditService.updateVendorCredit` accepts edits at
 *  (vendorcredit/store_update.go — Draft only, stricter than Vendor Payment's
 *  DRFT/PAPV window). */
export const VC_EDITABLE_STATUSES = new Set(['DRFT']);

/** Statuses from which Apply is allowed (vendorcredit/apply.go
 *  appliableStatuses) — unapproved credit must never offset AP. */
export const VC_APPLIABLE_STATUSES = new Set(['APPV', 'APPL']);

/** Bill statuses Apply will settle against (vendorbill.PayableStatuses) — a
 *  bill must be approved before credit can be applied to it. Used to explain
 *  an empty bill picker rather than to gate the request. */
export const VC_PAYABLE_BILL_STATUSES = new Set(['APPV', 'PART', 'ODUE']);

/** Why apply is unavailable, or null when it is available — drives the
 *  disabled button's tooltip so the reason is never silently swallowed. */
export function applyBlockedReason(statusCode: string, unappliedAmount: number): string | null {
  if (!VC_APPLIABLE_STATUSES.has(statusCode)) {
    return statusCode === 'DRFT'
      ? 'Approve this vendor credit before applying it to a bill.'
      : 'A voided vendor credit cannot be applied.';
  }
  if (unappliedAmount <= 0) return 'No unapplied balance remaining.';
  return null;
}

// ── Form defaults ─────────────────────────────────────────────────────────────

export function vendorCreditDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    credit_date: today,
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

/** Maps the AddVendorCreditPage form state to the backend's
 *  `CreateVendorCreditPayload`. Status is intentionally omitted: every new
 *  credit starts at DRFT server-side. */
export function toCreatePayload(
  data: Record<string, unknown>,
  vendorUuid: string,
  customFields: Record<string, unknown> = {},
): CreateVendorCreditPayload {
  return {
    vendorUuid,
    referenceNumber: toStr(data.reference_num),
    creditDate: toStr(data.credit_date) || undefined,
    reason: toStr(data.reason),
    memo: toStr(data.memo),
    internalNotes: toStr(data.internal_notes),
    ownerEmployeeId: toIntOrNull(data.owner_employee),
    amount: toNum(data.amount),
    customFields,
  };
}

/** Maps the EditVendorCreditPage form state to the backend's
 *  `UpdateVendorCreditPayload` (amount included — editable while DRFT). */
export function toUpdatePayload(
  data: Record<string, unknown>,
  customFields: Record<string, unknown> = {},
): UpdateVendorCreditPayload {
  return {
    referenceNumber: toStr(data.reference_num),
    creditDate: toStr(data.credit_date) || undefined,
    reason: toStr(data.reason),
    memo: toStr(data.memo),
    internalNotes: toStr(data.internal_notes),
    ownerEmployeeId: toIntOrNull(data.owner_employee),
    amount: toNum(data.amount),
    customFields,
  };
}

/** id-or-empty for a lookupKey <select>'s bound value: null/undefined must
 *  render as "— Select —" (empty string), never "0" or "null". */
function idOrEmpty(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

/** Maps a loaded VendorCredit (GET response) back to the Edit form's state —
 *  the inverse of toUpdatePayload. The vendor is returned separately since
 *  Edit displays it read-only, not through this field grid. */
export function fromVendorCredit(credit: VendorCredit): {
  data: Record<string, unknown>;
  vendor: { id: string; name: string };
  customFieldValues: Record<string, unknown>;
} {
  const data: Record<string, unknown> = {
    credit_date: credit.creditDate ? credit.creditDate.slice(0, 10) : '',
    reference_num: credit.referenceNumber ?? '',
    amount: String(credit.grandTotal ?? ''),
    reason: credit.reason ?? '',
    owner_employee: idOrEmpty(credit.ownerEmployeeId),
    memo: credit.memo ?? '',
    internal_notes: credit.internalNotes ?? '',
  };
  return {
    data,
    vendor: { id: credit.vendor.id, name: credit.vendor.name },
    customFieldValues: credit.customFields ?? {},
  };
}

/** Required-field check for the vendor_credit workflow's custom field
 *  definitions (rendered via DynamicFieldInput) — mirrors
 *  validateVendorPaymentCustomFields. */
export function validateVendorCreditCustomFields(
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
