// Vendor Bill module — frontend contract types.
//
// Mirrors the dedicated relational Vendor Bill backend module
// (`StoneSuite-Backend/vendorbill/*.go`,
// `docs/superpowers/specs/2026-08-10-vendor-bill-module-design.md`). The
// accounts-payable mirror of Invoice — a sibling of Estimate/Quote/
// SalesOrder/Invoice/PurchaseOrder, not the generic v1 JSONB CRM router —
// served from `/api/tenant/vendor-bills*`. Unlike Purchase Order, a vendor
// bill has no shipping/address block and carries its own settlement ledger
// (payments) plus optional Purchase Order lineage.
import type { FilterClause, RecordApprover, SortKey } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

/** One billed line. `inventoryItemUuid` selects a catalog item (server
 *  snapshots its sku/name/description/unit/price/tax); omit it for a
 *  free-text line, in which case `description` is required. There is no
 *  `purchaseOrderItemUuid` input field — that lineage FK is set exclusively
 *  by the convert path, never by manual create/update input. */
export interface VendorBillLineInput {
  lineNumber: number;
  inventoryItemUuid?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxRateId?: number | null;
}

export interface CreateVendorBillPayload {
  vendorUuid: string;
  vendorInvoiceNumber?: string;
  referenceNumber?: string;
  billDate?: string;    // ISO date "yyyy-mm-dd" — defaults to CURRENT_DATE server-side
  dueDate?: string;      // ISO date "yyyy-mm-dd"
  paymentTermsId?: number | null;
  currencyId?: number | null;
  ownerEmployeeId?: number | null;
  salesTaxPercent?: number;
  memo?: string;
  notes?: string;
  internalNotes?: string;
  termsConditions?: string;
  adjustment?: number;
  customFields?: Record<string, unknown>;
  items: VendorBillLineInput[];
}

/** Update mirrors create minus the vendor (a vendor bill's vendor is fixed
 *  after creation — AD-2). Rejected by the server with a 400 once the bill
 *  has left DRFT — recall to draft to edit. */
export type UpdateVendorBillPayload = Omit<CreateVendorBillPayload, 'vendorUuid'>;

// ── Responses (server → client) ──────────────────────────────────────────────

export interface VendorBillVendorRef {
  id: string;
  name: string;
  number?: string;
}

/** Flattened {id, number} lineage reference — present only when this bill was
 *  created via a purchase order's "Convert to Bill" action (AD-8). */
export interface VendorBillPurchaseOrderRef {
  id: string;
  number: string;
}

export interface VendorBillLine {
  id: string;
  lineNumber: number;
  inventoryItemId?: string | null;
  purchaseOrderItemId?: string | null;
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

/** One live vendor payment application against this bill — read-only. A bill
 *  no longer owns its settlement ledger: money reaches it exclusively through
 *  the Vendor Payment module's application ledger (`vendorpayment.Apply`), so
 *  `GET /vendor-bills/{id}/payments` is an AP reconciliation view, not a
 *  mutation surface. To settle a bill, create or apply a vendor payment. */
export interface VendorBillPaymentEntry {
  vendorPaymentId: string;
  vendorPaymentNumber: string;
  amount: number;
  appliedAt: string;
}

/** One live vendor payment refund against this bill — money the vendor sent
 *  back, which reduces what this bill counts as settled. Also read-only. */
export interface VendorBillRefundEntry {
  vendorPaymentId: string;
  vendorPaymentNumber: string;
  amount: number;
  reason: string;
  refundedAt: string;
}

/** Both halves of `GET /vendor-bills/{id}/payments`. */
export interface VendorBillPaymentLedger {
  payments: VendorBillPaymentEntry[];
  refunds: VendorBillRefundEntry[];
}

/** `lkp_record_status` code for the VBIL record type — the state machine
 *  (spec AD-5): invoice's machine minus SENT, since a bill is received
 *  rather than sent. */
export type VendorBillStatusCode =
  | 'DRFT' | 'PAPV' | 'APPV' | 'PART' | 'ODUE' | 'PAID' | 'VOID';

// Full detail response (GET/Create/Update/Transition/Approve/RecordPayment).
// Every field the create/update contract accepts round-trips back here too,
// so the Edit page can reload a vendor bill and re-save it without silently
// blanking any header field.
export interface VendorBill {
  id: string;
  vendorBillNumber: string;

  status: string;                     // human label, e.g. "Draft"
  statusCode: VendorBillStatusCode;   // drives the transition button map
  approvalStatus: 'none' | 'pending' | 'approved'; // AD-6
  gated: boolean;
  approvers: RecordApprover[];
  requiredApprovals: number;
  approvedCount: number;
  canApprove: boolean;
  isOverride: boolean;
  callerAlreadyApproved: boolean;

  vendor: VendorBillVendorRef;
  purchaseOrder?: VendorBillPurchaseOrderRef; // nullable lineage (AD-8)

  ownerEmployeeId?: number | null;

  vendorInvoiceNumber: string;
  referenceNumber: string;
  billDate: string;
  dueDate?: string;

  paymentTermsId: number | null;
  currencyId: number | null;
  exchangeRate: number;
  salesTaxPercent: number;

  memo: string;
  notes: string;
  internalNotes: string;
  termsConditions: string;

  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  adjustment: number;
  grandTotal: number;

  amountPaid: number;
  balanceDue: number;

  customFields?: Record<string, unknown>;
  items: VendorBillLine[];

  createdAt?: string;
  updatedAt?: string;
  recordVersion?: number;
}

/** List/search rows are full `VendorBill` records server-side with `items`
 *  omitted (mirrors purchaseorder.Search) — this type only names the subset
 *  the table actually renders. */
export type VendorBillSummary = Pick<
  VendorBill,
  | 'id' | 'vendorBillNumber' | 'status' | 'statusCode' | 'approvalStatus'
  | 'vendor' | 'purchaseOrder' | 'vendorInvoiceNumber' | 'billDate' | 'dueDate'
  | 'grandTotal' | 'amountPaid' | 'balanceDue' | 'ownerEmployeeId'
  | 'createdAt' | 'updatedAt'
>;

/** Search request = the shared `query.Request` plus the optional global-search
 *  term the vendor bill resolver supports. */
export interface VendorBillSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface VendorBillPage {
  records: VendorBillSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
