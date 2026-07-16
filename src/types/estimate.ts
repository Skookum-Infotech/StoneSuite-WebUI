// Estimate module — frontend contract types.
//
// These mirror the dedicated relational Estimate backend module
// (`StoneSuite-Backend/estimate/*.go`, `docs/superpowers/specs/2026-07-14-estimates-quotes-module-design.md`).
// They are intentionally distinct from the generic `WorkflowRecord` used by the
// v1 JSONB CRM router — Estimates are a relational sibling of `sales_order`/
// `invoice` with ordered line items, snapshots, and stored money totals,
// served from `/api/tenant/estimates*`.
import type { FilterClause, SortKey } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

/** Billing or shipping snapshot block. All fields optional; the server fills
 *  gaps from the referenced customer at create time. IDs reference `lkp_state`
 *  / `lkp_country`. */
export interface EstimateAddressInput {
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

/** One estimated line. `inventoryItemUuid` selects a catalog item (server
 *  snapshots its sku/name/unit/price, ignoring `description` unless the
 *  catalog item has none); omit it for a free-text line, in which case
 *  `description` is required and becomes both the line's item name and
 *  description. Per-line tax comes from `taxRateId` (a named `lkp_tax_rate`)
 *  or defaults to the header `salesTaxPercent`. */
export interface EstimateLineInput {
  lineNumber: number;
  inventoryItemUuid?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxRateId?: number | null;
}

export interface EstimateCreatePayload {
  customerUuid: string;
  poNumber?: string;
  referenceNumber?: string;
  estimateDate?: string;       // ISO date "yyyy-mm-dd" — defaults to CURRENT_DATE server-side
  validUntil?: string;         // ISO date "yyyy-mm-dd"
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
  billing?: EstimateAddressInput;
  shipping?: EstimateAddressInput;
  shippingCharge?: number;
  adjustment?: number;
  customFields?: Record<string, unknown>;
  items: EstimateLineInput[];
}

/** Update mirrors create minus the customer (an estimate's customer is fixed
 *  after creation). Rejected by the server with a 400 once the estimate has
 *  reached a terminal status (RJCT/EXPR/CANC). */
export type EstimateUpdatePayload = Omit<EstimateCreatePayload, 'customerUuid'>;

// ── Responses (server → client) ──────────────────────────────────────────────

export interface EstimateCustomerRef {
  id: string;
  name: string;
}

export interface EstimateLine {
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

// Full detail response (GET/Create/Update/Transition/Approve). Every field the
// create/update contract accepts round-trips back here too, so the Edit page
// can reload an estimate and re-save it without silently blanking billing/
// shipping or any header field.
export interface Estimate {
  id: string;
  estimateNumber: string;
  status: string;              // human label, e.g. "Draft"
  statusCode: string;          // lkp_record_status code, e.g. "DRFT" — drives transitions
  approvalStatus: string;      // none | pending | approved (AD-8)
  customer: EstimateCustomerRef;
  estimateDate: string;
  validUntil?: string;
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
  billing: EstimateAddressInput;
  shipping: EstimateAddressInput;
  customFields?: Record<string, unknown>;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCharge: number;
  adjustment: number;
  grandTotal: number;
  createdAt?: string;
  updatedAt?: string;
  items: EstimateLine[];
}

/** List/search rows are full `Estimate` records server-side (Search returns
 *  `estimate.Estimate[]` with `items` omitted) — this type only names the
 *  subset the table actually renders. */
export type EstimateSummary = Pick<
  Estimate,
  'id' | 'estimateNumber' | 'status' | 'statusCode' | 'customer' | 'estimateDate' | 'validUntil' | 'grandTotal' | 'createdAt' | 'updatedAt'
>;

/** Search request = the shared `query.Request` plus the optional global-search
 *  term the estimate resolver supports. */
export interface EstimateSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface EstimatePage {
  records: EstimateSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
