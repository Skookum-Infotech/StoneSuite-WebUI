// Purchase Order module — frontend contract types.
//
// Mirrors the dedicated relational Purchase Order backend module
// (`StoneSuite-Backend/purchaseorder/*.go`,
// `docs/superpowers/specs/2026-07-22-purchase-order-module-design.md`). A
// sibling of Estimate/Quote/SalesOrder/Invoice — not the generic v1 JSONB CRM
// router — served from `/api/tenant/purchase-orders*`. Structurally
// identical to Estimate, with a vendor instead of a customer and a single
// ship-to address instead of a billing/shipping pair.
import type { FilterClause, SortKey } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

/** Ship-to (deliver-to) snapshot block. All fields optional; POs carry a
 *  single address — there is no billing block (the bill-to is the tenant
 *  itself). IDs reference `lkp_state` / `lkp_country`. */
export interface PurchaseOrderAddressInput {
  name?: string;
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
 *  snapshots its sku/name/description/unit/price/tax); omit it for a
 *  free-text line, in which case `description` is required. `taxRateId` is
 *  accepted by the backend but has no lookup UI yet (mirrors Estimate/Quote/
 *  Invoice/SalesOrder) — every line's tax preview follows the header
 *  `salesTaxPercent` instead. */
export interface PurchaseOrderLineInput {
  lineNumber: number;
  inventoryItemUuid?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxRateId?: number | null;
}

export interface PurchaseOrderCreatePayload {
  vendorUuid: string;
  referenceNumber?: string;
  orderDate?: string;      // ISO date "yyyy-mm-dd" — defaults to CURRENT_DATE server-side
  expectedDate?: string;   // ISO date "yyyy-mm-dd"
  paymentTermsId?: number | null;
  currencyId?: number | null;
  ownerEmployeeId?: number | null;
  salesTaxPercent?: number;
  memo?: string;
  notes?: string;
  internalNotes?: string;
  termsConditions?: string;
  shipTo?: PurchaseOrderAddressInput;
  shippingCharge?: number;
  adjustment?: number;
  customFields?: Record<string, unknown>;
  items: PurchaseOrderLineInput[];
}

/** Update mirrors create minus the vendor (a purchase order's vendor is fixed
 *  after creation — AD-2). Rejected by the server with a 400 once the order
 *  has left DRFT — recall to draft to edit. */
export type PurchaseOrderUpdatePayload = Omit<PurchaseOrderCreatePayload, 'vendorUuid'>;

// ── Responses (server → client) ──────────────────────────────────────────────

export interface PurchaseOrderVendorRef {
  id: string;
  name: string;
  number?: string;
}

export interface PurchaseOrderLine {
  id: string;
  lineNumber: number;
  inventoryItemId?: string | null;
  sku: string;
  itemName: string;
  description: string;
  unitCode: string;
  quantity: number;
  /** Cumulative quantity received against this line via Item Receipt — 0
   *  until that module ships (AD-4 receiving hook). */
  qtyReceived: number;
  unitPrice: number;
  discountPercent: number;
  taxPercent: number;
  lineSubtotal: number;
  lineDiscount: number;
  lineTax: number;
  lineTotal: number;
}

/** `lkp_record_status` code for the PORD record type — the fixed, mostly
 *  forward-only state machine (spec AD-5). */
export type PurchaseOrderStatusCode =
  | 'DRFT' | 'PAPV' | 'APPV' | 'SENT' | 'PART' | 'RCVD' | 'CLSD' | 'CANC';

// Full detail response (GET/Create/Update/Transition/Approve). Every field
// the create/update contract accepts round-trips back here too, so the Edit
// page can reload a purchase order and re-save it without silently blanking
// the ship-to block or any header field.
export interface PurchaseOrder {
  id: string;
  purchaseOrderNumber: string;
  status: string;                       // human label, e.g. "Draft"
  statusCode: PurchaseOrderStatusCode;   // drives the transition button map
  approvalStatus: 'none' | 'pending' | 'approved'; // AD-6
  vendor: PurchaseOrderVendorRef;
  orderDate: string;
  expectedDate?: string;
  referenceNumber?: string;
  memo?: string;
  notes?: string;
  internalNotes?: string;
  termsConditions?: string;
  paymentTermsId: number | null;
  currencyId: number | null;
  ownerEmployeeId: number | null;
  salesTaxPercent: number;
  shipTo: PurchaseOrderAddressInput;
  customFields?: Record<string, unknown>;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCharge: number;
  adjustment: number;
  grandTotal: number;
  createdAt?: string;
  updatedAt?: string;
  items: PurchaseOrderLine[];
}

/** List/search rows are full `PurchaseOrder` records server-side with `items`
 *  omitted (spec §1.1) — this type only names the subset the table actually
 *  renders. */
export type PurchaseOrderSummary = Pick<
  PurchaseOrder,
  | 'id' | 'purchaseOrderNumber' | 'status' | 'statusCode' | 'approvalStatus'
  | 'vendor' | 'orderDate' | 'expectedDate' | 'grandTotal' | 'ownerEmployeeId'
  | 'createdAt' | 'updatedAt'
>;

/** Search request = the shared `query.Request` plus the optional global-search
 *  term the purchase order resolver supports. */
export interface PurchaseOrderSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface PurchaseOrderPage {
  records: PurchaseOrderSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
