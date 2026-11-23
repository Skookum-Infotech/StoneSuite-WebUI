// Credit Memo module — frontend contract types.
//
// A dedicated relational sibling of Invoice/Payment — a credit issued against
// a customer that can be applied against one or more invoices (mirrors
// Payment's cross-invoice application model), served from
// `/api/tenant/credit-memos*`, distinct from the generic `WorkflowRecord`
// JSONB CRM router.
import type { FilterClause, RecordApprover, SortKey, ApprovalRejection } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

/** Billing snapshot block — unlike Invoice, Credit Memo has no shipping
 *  address. All fields optional; the server fills gaps from the referenced
 *  customer at create time. IDs reference `lkp_state` / `lkp_country`. */
export interface CreditMemoAddressInput {
  customerName?: string;
  attention?: string;
  addrLine1?: string;
  addrLine2?: string;
  suiteUnit?: string;
  city?: string;
  stateId?: number | null;
  countryId?: number | null;
  zip?: string;
  phone?: string;
  fax?: string;
  email?: string;
}

export interface CreditMemoCreatePayload {
  customerUuid: string;
  invoiceUuid?: string;
  salesOrderUuid?: string;
  /** Issues the memo from this payment's overpayment: the memo's total is taken
   *  out of what the payment can still be applied or refunded. */
  sourcePaymentUuid?: string;
  /** The credit — replaces line items. Sales tax and adjustment apply on top. */
  amount: number;
  currencyId?: number | null;
  referenceNumber?: string;
  creditMemoDate?: string;     // ISO date "yyyy-mm-dd" — defaults to CURRENT_DATE server-side
  reason?: string;
  salesTaxPercent?: number;
  memo?: string;
  notes?: string;
  internalNotes?: string;
  adjustment?: number;
  billing?: CreditMemoAddressInput;
  customFields?: Record<string, unknown>;
  // Applications must never be sent at create time — they're only created via
  // the dedicated /apply endpoint once the credit memo is approved.
}

/** Update mirrors create minus the customer/invoice/salesOrder lineage (all
 *  three are immutable after creation), plus `recordVersion` for optimistic
 *  locking — every PATCH must carry the version it read. */
export type CreditMemoUpdatePayload = Omit<
  CreditMemoCreatePayload,
  'customerUuid' | 'invoiceUuid' | 'salesOrderUuid' | 'sourcePaymentUuid' | 'amount'
> & {
  /** Only sent when the user changed it — the backend replaces any legacy line
   *  items with this single amount. */
  amount?: number;
  recordVersion: number;
};

// ── Apply / unapply ───────────────────────────────────────────────────────────

export interface CreditMemoApplyInput {
  invoiceUuid: string;
  amount: number;
}

export interface CreditMemoUnapplyInput {
  invoiceUuid: string;
}

// ── Responses (server → client) ──────────────────────────────────────────────

export interface CreditMemoCustomerRef {
  id: string;
  name: string;
}

export interface CreditMemoInvoiceRef {
  id: string;
  number: string;
}

export interface CreditMemoSalesOrderRef {
  id: string;
  number: string;
}

/** The payment a credit memo was issued from — its overpayment funds the memo. */
export interface CreditMemoPaymentRef {
  id: string;
  number: string;
}

export interface CreditMemoLine {
  id: string;
  lineNumber: number;
  inventoryItemId?: string | null;
  sku: string;
  itemName: string;
  description: string;
  unitCode: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  lineSubtotal: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
}

export interface CreditMemoApplication {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  amount: number;
  createdAt: string;
}

// Full detail response (GET/Create/Update/Transition/Apply/Unapply). Every
// field the create/update contract accepts round-trips back here too, so the
// Edit page can reload a credit memo and re-save it without silently
// blanking billing or any header field.
export interface CreditMemo {
  id: string;
  creditMemoNumber: string;
  status: string;              // human label, e.g. "Draft"
  statusCode: string;          // lkp_record_status code, e.g. "DRFT" — drives transitions
  approvalStatus: 'none' | 'pending' | 'approved';
  gated: boolean;
  approvers: RecordApprover[];
  requiredApprovals: number;
  approvedCount: number;
  canApprove: boolean;
  isOverride: boolean;
  callerAlreadyApproved: boolean;
  canReject?: boolean;            // whether the requesting user can reject it right now (configured approver OR super admin, while it awaits approval)
  rejection?: ApprovalRejection;  // who rejected it and why -- present while it still sits in the status the rejection left it in
  customer: CreditMemoCustomerRef;
  invoice?: CreditMemoInvoiceRef | null;
  salesOrder?: CreditMemoSalesOrderRef | null;
  sourcePayment?: CreditMemoPaymentRef | null;
  currencyId?: number | null;
  referenceNumber?: string;
  creditMemoDate: string;
  reason?: string;
  salesTaxPercent: number;
  memo?: string;
  notes?: string;
  internalNotes?: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  adjustment: number;
  grandTotal: number;
  appliedTotal: number;
  unappliedAmount: number;
  billing: CreditMemoAddressInput;
  customFields?: Record<string, unknown>;
  /** Empty for memos created from an amount; kept for older memos that were
   *  entered as line items. */
  lines: CreditMemoLine[];
  applications: CreditMemoApplication[];
  createdAt?: string;
  updatedAt?: string;
  recordVersion?: number;
}

/** List/search rows are full `CreditMemo` records server-side — this type
 *  only names the subset the table actually renders. */
export type CreditMemoSummary = Pick<
  CreditMemo,
  | 'id' | 'creditMemoNumber' | 'status' | 'statusCode' | 'customer'
  | 'creditMemoDate' | 'reason' | 'grandTotal' | 'appliedTotal' | 'unappliedAmount'
  | 'createdAt' | 'updatedAt'
>;

export interface CreditMemoSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface CreditMemoPage {
  records: CreditMemoSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
