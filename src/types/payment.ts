// Payment module — frontend contract types.
//
// Mirrors the dedicated relational Payment backend module
// (StoneSuite-Backend/payment/*.go,
// docs/superpowers/specs/2026-07-13-payments-module-design.md). Payment is a
// sibling of Invoice — a money ledger with cross-invoice application — served
// from /api/tenant/payments*, distinct from the generic WorkflowRecord JSONB
// CRM router.
import type { FilterClause, RecordApprover, SortKey } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

export interface ApplicationInput {
  invoiceUuid: string;
  amount: number;
}

export interface PaymentCreatePayload {
  customerUuid: string;
  methodId: number;
  referenceNumber?: string;
  paymentDate?: string;        // RFC3339 timestamp string — see lib/paymentForm.ts's date-handling note
  currencyId?: number | null;
  ownerEmployeeId?: number | null;
  amount: number;
  memo?: string;
  internalNotes?: string;
  customFields?: Record<string, unknown>;
  applications?: ApplicationInput[];
}

/** Update mirrors create minus customerUuid/amount/applications — a
 *  payment's customer and amount are fixed after creation (backend AD-10:
 *  amount is immutable), and applications are managed through /apply and
 *  /unapply, not PATCH. */
export type PaymentUpdatePayload = Omit<
  PaymentCreatePayload,
  'customerUuid' | 'amount' | 'applications'
>;

// ── Responses (server → client) ──────────────────────────────────────────────

export interface PaymentCustomerRef {
  id: string;
  name: string;
}

export interface PaymentApplication {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  createdAt: string;
}

export interface Payment {
  id: string;
  paymentNumber: string;
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
  customer: PaymentCustomerRef;
  ownerEmployeeId?: number | null;
  methodId: number;
  method: string;
  referenceNumber: string;
  paymentDate: string;
  currencyId?: number | null;
  memo: string;
  internalNotes: string;
  amount: number;
  appliedTotal: number;
  unappliedAmount: number;
  customFields?: Record<string, unknown>;
  applications: PaymentApplication[];
  createdAt?: string;
  updatedAt?: string;
  recordVersion?: number;
}

/** List/search rows are full `Payment` records server-side — this type only
 *  names the subset the table actually renders. */
export type PaymentSummary = Pick<
  Payment,
  | 'id' | 'paymentNumber' | 'status' | 'statusCode' | 'approvalStatus' | 'customer'
  | 'paymentDate' | 'amount' | 'unappliedAmount' | 'createdAt' | 'updatedAt'
>;

export interface PaymentSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface PaymentPage {
  records: PaymentSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
