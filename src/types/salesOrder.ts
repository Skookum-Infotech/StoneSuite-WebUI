// Sales Order module — frontend contract types.
//
// These mirror the dedicated relational Sales Order backend module described in
// `StoneSuite-Backend/docs/superpowers/specs/2026-07-08-sales-order-module-design.md`
// (§10 API contracts, §11 listing). They are intentionally distinct from the
// generic `WorkflowRecord` used by the v1 JSONB CRM router — Sales Orders are a
// relational sibling of `customer` with ordered line items, snapshots, and
// stored money totals, served from `/api/tenant/sales-orders*`.
import type { FilterClause, SortKey, RecordApprover } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

/** Billing or shipping snapshot block. All fields optional; the server fills
 *  gaps from the referenced customer at create time. IDs reference `lkp_state`
 *  / `lkp_country`. */
export interface SalesOrderAddressInput {
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
 *  snapshots its sku/name/description/unit/price/tax, ignoring sku/itemName/
 *  unitCode/taxPercent below); omit it for a free-text line, in which case
 *  `description` is required and sku/itemName/unitCode/taxPercent (when set)
 *  are taken as typed. Per-line tax otherwise comes from `taxRateId` (or the
 *  header `salesTaxPercent` default). */
export interface SalesOrderLineInput {
  lineNumber: number;
  inventoryItemUuid?: string;
  description?: string;
  sku?: string;
  itemName?: string;
  unitCode?: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxRateId?: number | null;
  taxPercent?: number;
  warehouseId?: number | null;
}

export interface SalesOrderCreatePayload {
  customerUuid: string;
  poNumber?: string;
  referenceNumber?: string;
  orderDate?: string;          // ISO date "yyyy-mm-dd"
  expectedDelivery?: string;   // ISO date "yyyy-mm-dd"
  /** ISO date "yyyy-mm-dd". Optional — if omitted and paymentTermsId is set,
   *  the server derives it as orderDate + the term's net-days (AD-8). */
  paymentDueDate?: string;
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
  billing?: SalesOrderAddressInput;
  shipping?: SalesOrderAddressInput;
  shippingCharge?: number;
  adjustment?: number;
  customFields?: Record<string, unknown>;
  items: SalesOrderLineInput[];
}

/** Update mirrors create minus the customer (an order's customer is fixed). */
export type SalesOrderUpdatePayload = Omit<SalesOrderCreatePayload, 'customerUuid'>;

// ── Responses (server → client) ──────────────────────────────────────────────

export interface SalesOrderCustomerRef {
  id: string;
  name: string;
}

export interface SalesOrderLine {
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
  /** Stored rollup of this line's fulfilled allocations (AD-9). */
  fulfilledQuantity: number;
  /** Derived server-side from fulfilledQuantity vs quantity — never stored,
   *  always "open" until the fulfillment flow ships. */
  status: 'open' | 'partial' | 'filled';
}

// Full detail response (GET/Create/Update). Every field the create/update
// contract accepts round-trips back here too, so the Edit page can reload an
// order and re-save it without silently blanking billing/shipping or any
// header field (server backfilled this after an earlier gap where Get only
// returned display-only summary fields).
export interface SalesOrder {
  id: string;
  salesOrderNumber: string;
  status: string;             // human label, e.g. "Draft"
  statusCode: string;         // lkp_record_status code, e.g. "DRFT" — drives transitions
  approvalStatus: string;     // none | pending | approved (AD-10) -- display only, can go stale; use `gated` to decide UI behavior
  gated: boolean;              // authoritative: true iff a live approval gate is currently blocking transitions out of this status
  approvers: RecordApprover[]; // configured approvers for the current status; only populated while gated
  requiredApprovals: number;  // how many sign-offs the current status's quorum needs (e.g. 2)
  approvedCount: number;      // how many of them have signed off so far
  canApprove: boolean;        // whether the requesting user can approve (configured approver OR super admin)
  isOverride: boolean;        // true when canApprove is only true because the user is a super admin, not a configured approver
  callerAlreadyApproved: boolean; // true if the requesting user already signed off this round (quorum may still need others)
  customer: SalesOrderCustomerRef;
  orderDate: string;
  expectedDelivery?: string;
  paymentDueDate?: string;
  poNumber?: string;
  referenceNumber?: string;
  memo?: string;
  notes?: string;
  internalNotes?: string;
  termsConditions?: string;
  paymentTermsId: number | null;
  priceLevelId: number | null;
  currencyId: number | null;
  salesRepEmployeeId: number | null;
  ownerEmployeeId: number | null;
  salesTaxPercent: number;
  shipSameAsBilling: boolean;
  billing: SalesOrderAddressInput;
  shipping: SalesOrderAddressInput;
  customFields?: Record<string, unknown>;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCharge: number;
  adjustment: number;
  grandTotal: number;
  createdAt?: string;
  updatedAt?: string;
  items: SalesOrderLine[];
}

/** List-row projection (design §11 returns "order summaries"; exact server
 *  shape is finalized during backend implementation — treat extra fields as
 *  optional). */
export interface SalesOrderSummary {
  id: string;
  salesOrderNumber: string;
  status: string;
  statusCode?: string;
  approvalStatus?: string;
  customer?: SalesOrderCustomerRef;
  orderDate?: string;
  grandTotal?: number;
  createdAt?: string;
  updatedAt?: string;
}

/** Search request = the shared `query.Request` plus the optional global-search
 *  term the SO resolver supports (design §11.5). */
export interface SalesOrderSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface SalesOrderPage {
  records: SalesOrderSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}

/** One row of the Inventory tab (design §10 `/inventory`). */
export interface SalesOrderInventoryRow {
  itemId: string;
  sku: string;
  onHand: number;
  available: number;
  allocated: number;
  salesOrderQuantity: number;
}
