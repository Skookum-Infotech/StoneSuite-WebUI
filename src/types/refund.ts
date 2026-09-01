// Refund module — frontend contract types.
//
// Mirrors the dedicated relational Refund backend module
// (StoneSuite-Backend/refund/types.go,
// docs/superpowers/specs/2026-07-16-refund-module-design.md). Refund is a
// sibling of Payment — money returned to a customer — served from
// /api/tenant/refunds*, distinct from the generic WorkflowRecord JSONB CRM
// router.
//
// Two ways it diverges from Payment, both load-bearing here:
//
//  1. Its application ledger is *dual-source* (spec AD-2): one application row
//     draws from exactly one of a payment (an overpayment) or a credit memo (an
//     unapplied credit) — never both, never an invoice. The XOR is a DB CHECK
//     constraint (chk_refund_app_xor_source), so exactly one id field of each
//     pair below is populated on any given row.
//  2. It has no line items and no subtotal/tax rollup (spec AD-1) — a refund is
//     scalar; the itemization already lives on the source document.
import type { FilterClause, RecordApprover, SortKey } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

export interface RefundCreatePayload {
  customerUuid: string;
  methodId: number;
  referenceNumber?: string;
  refundDate?: string;         // RFC3339 timestamp string — see lib/refundForm.ts's date-handling note
  currencyId?: number | null;
  ownerEmployeeId?: number | null;
  amount: number;
  reason?: string;
  memo?: string;
  internalNotes?: string;
  customFields?: Record<string, unknown>;

  // Lineage only (spec AD-12) — "this refund exists because of that document".
  // These carry NO money semantics: setting paymentUuid does not apply a
  // single cent against that payment. Money moves exclusively through
  // POST /refunds/{id}/apply, which requires the refund to be APPV first
  // (AD-5) — and a new refund always starts PEND, so an application at create
  // time could never be accepted. Verified against refund/store_create.go,
  // which routes all three through resolveLineage*() and never calls Apply.
  paymentUuid?: string;
  creditMemoUuid?: string;
  invoiceUuid?: string;
}

/** Update mirrors create minus customerUuid, amount, and all three lineage
 *  uuids — spec AD-8: money and source identity are immutable post-creation.
 *  To correct an approved refund, void it and create a new one. Confirmed
 *  against refund.UpdateRefundInput, which declares none of those fields. */
export type RefundUpdatePayload = Omit<
  RefundCreatePayload,
  'customerUuid' | 'amount' | 'paymentUuid' | 'creditMemoUuid' | 'invoiceUuid'
>;

// ── Responses (server → client) ──────────────────────────────────────────────

export interface RefundCustomerRef {
  id: string;
  name: string;
}

/** One live refund_application row. Exactly one of the payment* or
 *  creditMemo* pairs is populated (the XOR noted at the top of this file) —
 *  `refundApplicationSource` in lib/refundForm.ts narrows this safely. */
export interface RefundApplication {
  id: string;
  paymentId?: string;
  paymentNumber?: string;
  creditMemoId?: string;
  creditMemoNumber?: string;
  amount: number;
  createdAt: string;
}

export interface Refund {
  id: string;
  refundNumber: string;
  status: string;              // human label, e.g. "Pending"
  statusCode: string;          // lkp_record_status code, e.g. "PEND" — drives transitions
  approvalStatus: 'none' | 'pending' | 'approved';
  gated: boolean;
  approvers: RecordApprover[];
  requiredApprovals: number;
  approvedCount: number;
  canApprove: boolean;
  isOverride: boolean;
  callerAlreadyApproved: boolean;
  customer: RefundCustomerRef;
  ownerEmployeeId?: number | null;

  // Lineage only — see RefundCreatePayload's note. Never read by apply/unapply.
  paymentId?: string;
  creditMemoId?: string;
  invoiceId?: string;

  methodId: number;
  method: string;
  referenceNumber: string;
  refundDate: string;
  currencyId?: number | null;
  reason: string;
  memo: string;
  internalNotes: string;
  amount: number;
  appliedTotal: number;
  unappliedAmount: number;
  customFields?: Record<string, unknown>;
  applications: RefundApplication[];
  createdAt?: string;
  updatedAt?: string;
  recordVersion?: number;
}

/** List/search rows are full `Refund` records server-side — this type only
 *  names the subset the table actually renders. */
export type RefundSummary = Pick<
  Refund,
  | 'id' | 'refundNumber' | 'status' | 'statusCode' | 'approvalStatus' | 'customer'
  | 'refundDate' | 'amount' | 'unappliedAmount' | 'reason' | 'createdAt' | 'updatedAt'
>;

export interface RefundSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface RefundPage {
  records: RefundSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
