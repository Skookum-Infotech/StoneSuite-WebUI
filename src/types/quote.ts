// Quote module — frontend contract types.
//
// Mirrors the dedicated relational Quote backend module, sibling to Estimate
// (types/estimate.ts) — served from `/api/tenant/quotes*`, distinct from the
// generic WorkflowRecord JSONB CRM router. Like Estimate/SalesOrder/Invoice,
// a Quote's billing/shipping address references lkp_state/lkp_country by
// numeric id (stateId/countryId), not free-text. A line item is either a
// catalog pick or free-text, same as Estimate — see QuoteLineInput below.
import type { FilterClause, SortKey, RecordApprover } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

/** Billing or shipping snapshot block. All fields optional; the server fills
 *  gaps from the referenced customer at create time. IDs reference `lkp_state`
 *  / `lkp_country`. Matches the sibling SalesOrderAddressInput / EstimateAddressInput
 *  / InvoiceAddressInput shape (and the backend's quote.AddressInput struct). */
export interface QuoteAddressInput {
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
  // Used as the default "Send to Customer" recipient (quote.Recipient()).
  email?: string;
}

/** One quoted line. `inventoryItemUuid` selects a catalog item (server
 *  snapshots its sku/name/unit/price, ignoring `description` unless the
 *  catalog item has none); omit it for a free-text line, in which case
 *  `description` is required and becomes both the line's item name and
 *  description. Per-line tax comes from `taxRateId` (a named `lkp_tax_rate`)
 *  or defaults to the header `salesTaxPercent`. */
export interface QuoteLineInput {
  lineNumber: number;
  inventoryItemUuid?: string;
  description?: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  taxRateId?: number | null;
}

export interface QuoteCreatePayload {
  customerUuid: string;
  /** Set when this quote was converted from an estimate; omit for a
   *  standalone quote. Immutable after create. */
  estimateUuid?: string;
  poNumber?: string;
  referenceNumber?: string;
  quoteDate?: string;          // ISO date "yyyy-mm-dd" — defaults to CURRENT_DATE server-side
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
  billing?: QuoteAddressInput;
  shipping?: QuoteAddressInput;
  shippingCharge?: number;
  adjustment?: number;
  customFields?: Record<string, unknown>;
  items: QuoteLineInput[];
}

/** Update mirrors create minus the customer and estimate lineage (both fixed
 *  after creation). Rejected by the server with a 400 once the quote has
 *  reached a terminal status (RJCT/EXPR/CANC). */
export type QuoteUpdatePayload = Omit<QuoteCreatePayload, 'customerUuid' | 'estimateUuid'>;

// ── Responses (server → client) ──────────────────────────────────────────────

export interface QuoteCustomerRef {
  id: string;
  name: string;
}

/** The estimate this quote was converted from, if any — drives the Detail
 *  page's "Source Estimate" link. */
export interface QuoteEstimateRef {
  id: string;
  number: string;
}

export interface QuoteLine {
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
// can reload a quote and re-save it without silently blanking billing/
// shipping or any header field.
export interface Quote {
  id: string;
  quoteNumber: string;
  status: string;              // human label, e.g. "Draft"
  statusCode: string;          // lkp_record_status code, e.g. "DRFT" — drives transitions
  approvalStatus: string;      // none | pending | approved -- display only, can go stale; use `gated` to decide UI behavior
  gated: boolean;              // authoritative: true iff a live approval gate is currently blocking transitions out of this status
  approvers: RecordApprover[]; // configured approvers for the current status; only populated while gated
  requiredApprovals: number;   // how many sign-offs the current status's quorum needs (e.g. 2)
  approvedCount: number;       // how many of them have signed off so far
  canApprove: boolean;         // whether the requesting user can approve (configured approver OR super admin)
  isOverride: boolean;         // true when canApprove is only true because the user is a super admin, not a configured approver
  callerAlreadyApproved: boolean; // true if the requesting user already signed off this round (quorum may still need others)
  customer: QuoteCustomerRef;
  estimate?: QuoteEstimateRef | null;
  quoteDate: string;
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
  billing: QuoteAddressInput;
  shipping: QuoteAddressInput;
  customFields?: Record<string, unknown>;
  subtotal: number;
  discountTotal: number;
  taxTotal: number;
  shippingCharge: number;
  adjustment: number;
  grandTotal: number;
  createdAt?: string;
  updatedAt?: string;
  items: QuoteLine[];
}

/** List/search rows are full `Quote` records server-side (items omitted) —
 *  this type only names the subset the table actually renders. */
export type QuoteSummary = Pick<
  Quote,
  'id' | 'quoteNumber' | 'status' | 'statusCode' | 'approvalStatus' | 'customer' | 'quoteDate' | 'validUntil' | 'grandTotal' | 'createdAt' | 'updatedAt'
>;

export interface QuoteSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface QuotePage {
  records: QuoteSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
