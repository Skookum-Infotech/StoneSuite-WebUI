// Invoice module — frontend contract types.
//
// These mirror the dedicated relational Invoice backend module
// (`StoneSuite-Backend/invoice/*.go`, `docs/superpowers/specs/2026-07-10-invoice-module-design.md`).
// They are intentionally distinct from the generic `WorkflowRecord` used by the
// v1 JSONB CRM router — Invoices are a relational sibling of `sales_order` with
// ordered line items, snapshots, and stored money totals (incl. amountPaid/
// balanceDue), served from `/api/tenant/invoices*`.
import type { FilterClause, RecordApprover, SortKey } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

/** Billing or shipping snapshot block. All fields optional; the server fills
 *  gaps from the referenced customer at create time. IDs reference `lkp_state`
 *  / `lkp_country`. */
export interface InvoiceAddressInput {
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

/** One ordered line. `inventoryItemUuid` selects a catalog item (server
 *  snapshots its sku/name/unit/price, ignoring `description` unless the
 *  catalog item has none); omit it for a free-text line, in which case
 *  `description` is required and becomes both the line's item name and
 *  description. Unlike Sales Order, there is no per-line free-text tax % or
 *  manual sku/itemName/unitCode override — per-line tax comes from
 *  `taxRateId` (a named `lkp_tax_rate`) or defaults to the header
 *  `salesTaxPercent`. */
export interface InvoiceLineInput {
  lineNumber: number;
  inventoryItemUuid?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxRateId?: number | null;
}

export interface InvoiceCreatePayload {
  customerUuid: string;
  poNumber?: string;
  referenceNumber?: string;
  invoiceDate?: string;        // ISO date "yyyy-mm-dd" — defaults to CURRENT_DATE server-side
  dueDate?: string;            // ISO date "yyyy-mm-dd"
  paymentTermsId?: number | null;
  priceLevelId?: number | null;
  currencyId?: number | null;
  salesRepEmployeeId?: number | null;
  ownerEmployeeId?: number | null;
  salesTaxPercent?: number;
  memo?: string;
  notes?: string;
  internalNotes?: string;
  termsConditions?: string;
  shipSameAsBilling?: boolean;
  billing?: InvoiceAddressInput;
  shipping?: InvoiceAddressInput;
  shippingCharge?: number;
  adjustment?: number;
  customFields?: Record<string, unknown>;
  items: InvoiceLineInput[];
}

/** Update mirrors create minus the customer (an invoice's customer is fixed
 *  after creation — UpdateInvoiceInput has no customerUuid). Rejected by the
 *  server with a 400 ("Cannot edit a PAID/VOID invoice") once the invoice has
 *  reached a terminal status. */
export type InvoiceUpdatePayload = Omit<InvoiceCreatePayload, 'customerUuid'>;

// ── Responses (server → client) ──────────────────────────────────────────────

export interface InvoiceCustomerRef {
  id: string;
  name: string;
}

/** Nullable lineage back to the originating Sales Order, set when this
 *  invoice was created via SalesOrder "Convert to Invoice". */
export interface InvoiceSalesOrderRef {
  id: string;
  number: string;
}

export interface InvoiceLine {
  id: string;
  lineNumber: number;
  inventoryItemId?: string | null;
  salesOrderItemId?: string | null;
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

// Full detail response (GET/Create/Update/Transition/RecordPayment). Every
// field the create/update contract accepts round-trips back here too, so the
// Edit page can reload an invoice and re-save it without silently blanking
// billing/shipping or any header field.
export interface Invoice {
  id: string;
  invoiceNumber: string;
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
  customer: InvoiceCustomerRef;
  salesOrder?: InvoiceSalesOrderRef | null;
  ownerEmployeeId?: number | null;
  salesRepEmployeeId?: number | null;
  poNumber?: string;
  referenceNumber?: string;
  invoiceDate: string;
  dueDate?: string;
  paymentTermsId: number | null;
  priceLevelId: number | null;
  currencyId: number | null;
  exchangeRate: number;
  salesTaxPercent: number;
  memo?: string;
  notes?: string;
  internalNotes?: string;
  termsConditions?: string;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCharge: number;
  adjustment: number;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
  shipSameAsBilling: boolean;
  billing: InvoiceAddressInput;
  shipping: InvoiceAddressInput;
  customFields?: Record<string, unknown>;
  items: InvoiceLine[];
  createdAt?: string;
  updatedAt?: string;
  recordVersion?: number;
}

/** List/search rows are full `Invoice` records server-side (List/Search return
 *  `invoice.Invoice[]`, not a lighter summary) — this type only names the
 *  subset the table actually renders. */
export type InvoiceSummary = Pick<
  Invoice,
  'id' | 'invoiceNumber' | 'status' | 'statusCode' | 'approvalStatus' | 'customer' | 'invoiceDate' | 'grandTotal' | 'balanceDue' | 'createdAt' | 'updatedAt'
>;

/** Search request = the shared `query.Request` plus the optional global-search
 *  term the invoice resolver supports (SearchPredicate over invoice #/PO/memo/
 *  notes/bill name/line sku-name/customer name-doc#). */
export interface InvoiceSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface InvoicePage {
  records: InvoiceSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
