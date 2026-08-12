// Vendor Payment module — frontend contract types.
//
// Mirrors the dedicated relational Vendor Payment backend module
// (`StoneSuite-Backend/vendorpayment/*.go`). The accounts-payable mirror of
// Payment — money out to a vendor, with a cross-bill application ledger —
// served from `/api/tenant/vendor-payments*`, not the generic WorkflowRecord
// JSONB CRM router. Its sibling on the receivables side is `types/payment.ts`;
// the document it settles is `types/vendorBill.ts`.
import type { FilterClause, SortKey } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

/** One bill-application entry of a create request. Applications after creation
 *  go through `/apply` + `/unapply`, never PATCH. */
export interface VendorPaymentApplicationInput {
  vendorBillUuid: string;
  amount: number;
}

export interface CreateVendorPaymentPayload {
  vendorUuid: string;
  methodId: number;
  referenceNumber?: string;
  /** RFC3339 timestamp string — the Go field is a *time.Time and rejects a
   *  bare "yyyy-mm-dd"; see vendorPaymentForm.ts's date-handling note. */
  paymentDate?: string;
  scheduledDate?: string;   // RFC3339; required before a move to SCHD
  currencyId?: number | null;
  ownerEmployeeId?: number | null;
  amount: number;
  memo?: string;
  internalNotes?: string;
  customFields?: Record<string, unknown>;
  applications?: VendorPaymentApplicationInput[];
}

/** Update mirrors create minus `vendorUuid`/`amount`/`applications` — the
 *  vendor is fixed at creation (backend AD-14) and the amount is immutable
 *  post-creation (AD-12). Accepted only while the payment is DRFT or PAPV;
 *  a 400 elsewhere surfaces as a normal save error. */
export type UpdateVendorPaymentPayload = Omit<
  CreateVendorPaymentPayload,
  'vendorUuid' | 'amount' | 'applications'
>;

// ── Responses (server → client) ──────────────────────────────────────────────

export interface VendorPaymentVendorRef {
  id: string;
  name: string;
}

/** One live `vendor_payment_application` row, joined with its bill's number. */
export interface VendorPaymentApplication {
  id: string;
  vendorBillId: string;
  vendorBillNumber: string;
  amount: number;
  createdAt: string;
}

/** One live `vendor_payment_refund` row (backend AD-5) — money the vendor
 *  sent back against a bill this payment settled. Read-only in the UI: the
 *  record/remove refund store functions have no HTTP route yet, so a payment's
 *  refunds only ever arrive as part of its GET response. */
export interface VendorPaymentRefund {
  id: string;
  vendorBillId: string;
  vendorBillNumber: string;
  amount: number;
  reason: string;
  referenceNumber: string;
  memo: string;
  refundedAt: string;
  createdAt: string;
}

/** `lkp_record_status` code for the VPAY record type — the state machine
 *  (vendorpayment/transitions.go). */
export type VendorPaymentStatusCode =
  | 'DRFT' | 'PAPV' | 'APPV' | 'SCHD' | 'SENT' | 'VOID';

// Full detail response (GET/Create/Update/Transition/Approve/Apply/Unapply).
export interface VendorPayment {
  id: string;
  vendorPaymentNumber: string;

  status: string;                        // human label, e.g. "Draft"
  statusCode: VendorPaymentStatusCode;    // drives the transition button map
  approvalStatus: 'none' | 'pending' | 'approved'; // AD-6

  vendor: VendorPaymentVendorRef;
  ownerEmployeeId?: number | null;
  approvedByEmployeeId?: number | null;

  methodId: number;
  method: string;

  referenceNumber: string;
  paymentDate: string;
  scheduledDate?: string | null;
  currencyId?: number | null;
  memo: string;
  internalNotes: string;

  amount: number;
  appliedTotal: number;
  unappliedAmount: number;

  customFields?: Record<string, unknown>;
  applications: VendorPaymentApplication[];
  refunds: VendorPaymentRefund[];

  createdAt?: string;
  updatedAt?: string;
  recordVersion?: number;
}

/** List/search rows are full `VendorPayment` records server-side with
 *  `applications`/`refunds` always empty (vendorpayment/search.go returns
 *  headers only) — this type only names the subset the table renders. */
export type VendorPaymentSummary = Pick<
  VendorPayment,
  | 'id' | 'vendorPaymentNumber' | 'status' | 'statusCode' | 'approvalStatus'
  | 'vendor' | 'method' | 'methodId' | 'referenceNumber'
  | 'paymentDate' | 'scheduledDate' | 'amount' | 'appliedTotal' | 'unappliedAmount'
  | 'ownerEmployeeId' | 'createdAt' | 'updatedAt'
>;

/** Search request = the shared `query.Request` plus the optional global-search
 *  term the vendor payment resolver supports (number, reference #, memo,
 *  vendor name). */
export interface VendorPaymentSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface VendorPaymentPage {
  records: VendorPaymentSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
