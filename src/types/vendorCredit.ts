// Vendor Credit module — frontend contract types.
//
// Mirrors the dedicated relational Vendor Credit backend module
// (`StoneSuite-Backend/vendorcredit/*.go`). The accounts-payable mirror of
// Credit Memo — a credit owed back by a vendor, header-only (no lines, no
// tax), with a cross-bill application ledger — served from
// `/api/tenant/vendor-credits*`, not the generic WorkflowRecord JSONB CRM
// router. Its sibling on the receivables side is `types/creditMemo.ts`; the
// document it settles is `types/vendorBill.ts`.
import type { FilterClause, RecordApprover, SortKey } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

export interface CreateVendorCreditPayload {
  vendorUuid: string;
  referenceNumber?: string;
  /** "yyyy-mm-dd"; blank => CURRENT_DATE server-side. Unlike Vendor Payment,
   *  this is a plain date string, not RFC3339 — vendorcredit.CreateVendorCreditInput's
   *  CreditDate is a Go string, not *time.Time. */
  creditDate?: string;
  reason?: string;
  memo?: string;
  internalNotes?: string;
  ownerEmployeeId?: number | null;
  amount: number;
  customFields?: Record<string, unknown>;
}

/** Update mirrors create minus `vendorUuid` — the vendor is fixed at creation
 *  (backend AD-12). Unlike Vendor Payment, `amount` IS editable here (accepted
 *  only while the credit is Draft — backend §8 — a 400 elsewhere surfaces as a
 *  normal save error). */
export type UpdateVendorCreditPayload = Omit<CreateVendorCreditPayload, 'vendorUuid'>;

// ── Responses (server → client) ──────────────────────────────────────────────

export interface VendorCreditVendorRef {
  id: string;
  name: string;
}

/** One live `vendor_credit_application` row, joined with its bill's number. */
export interface VendorCreditApplication {
  id: string;
  vendorBillId: string;
  vendorBillNumber: string;
  amount: number;
  createdAt: string;
}

/** `lkp_record_status` code for the VCRD record type — the state machine
 *  (vendorcredit/transitions.go). APPL is derived (reached only when the
 *  apply path fully consumes the credit), never user-directed. */
export type VendorCreditStatusCode = 'DRFT' | 'APPV' | 'APPL' | 'VOID';

// Full detail response (GET/Create/Update/Transition/Apply/Reverse).
export interface VendorCredit {
  id: string;
  vendorCreditNumber: string;

  status: string;                     // human label, e.g. "Draft"
  statusCode: VendorCreditStatusCode; // drives the transition button map
  approvalStatus: 'none' | 'pending' | 'approved'; // AD-8
  gated: boolean;
  approvers: RecordApprover[];
  requiredApprovals: number;
  approvedCount: number;
  canApprove: boolean;
  isOverride: boolean;
  callerAlreadyApproved: boolean;

  vendor: VendorCreditVendorRef;
  ownerEmployeeId?: number | null;

  referenceNumber: string;
  reason: string;
  memo: string;
  internalNotes: string;
  creditDate: string;

  grandTotal: number;
  appliedTotal: number;
  unappliedAmount: number;

  customFields?: Record<string, unknown>;
  applications: VendorCreditApplication[];

  createdAt?: string;
  updatedAt?: string;
  recordVersion?: number;
}

/** List/search rows are full `VendorCredit` records server-side with
 *  `applications` always empty (vendorcredit/store_search.go returns headers
 *  only) — this type only names the subset the table renders. */
export type VendorCreditSummary = Pick<
  VendorCredit,
  | 'id' | 'vendorCreditNumber' | 'status' | 'statusCode'
  | 'vendor' | 'referenceNumber' | 'reason'
  | 'creditDate' | 'grandTotal' | 'appliedTotal' | 'unappliedAmount'
  | 'ownerEmployeeId' | 'createdAt' | 'updatedAt'
>;

/** Search request = the shared `query.Request` plus the optional global-search
 *  term the vendor credit resolver supports (number, reference #, reason,
 *  memo, vendor name). */
export interface VendorCreditSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface VendorCreditPage {
  records: VendorCreditSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
