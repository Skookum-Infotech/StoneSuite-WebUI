// Requisition module — frontend contract types.
//
// Mirrors the dedicated relational Requisition backend module
// (`StoneSuite-Backend/requisition/*.go`). A requisition is an internal
// request-to-buy raised *before* a vendor or price is finalized, which an
// approver signs off and which then converts into a Purchase Order. It is a
// sibling of Estimate/Quote/SalesOrder/PurchaseOrder — not the generic v1
// JSONB CRM router — served from `/api/tenant/requisitions*`.
//
// Structurally a simplification of Purchase Order (see types/purchaseOrder.ts):
// no address block, no per-line discount or tax, no shipping/adjustment, and
// three live statuses instead of seven. A requisition is a rough ask, not a
// priced commitment.
import type { FilterClause, SortKey } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

/** One requested line. `inventoryItemUuid` selects a catalog item (the server
 *  snapshots its sku/name/description/unit/price); omit it for a free-text
 *  line, in which case `description` is required. Unlike a purchase order
 *  line there is no discount or per-line tax — the header's flat
 *  `salesTaxPercent` is the only tax input. */
export interface RequisitionLineInput {
  lineNumber: number;
  inventoryItemUuid?: string;
  description?: string;
  quantity: number;
  estimatedUnitPrice: number;
}

export interface RequisitionCreatePayload {
  requestedByEmployeeId?: number | null;
  department?: string;
  neededByDate?: string; // ISO date "yyyy-mm-dd"
  priority?: RequisitionPriority;
  memo?: string;
  /** Suggested vendor only — never promoted automatically to the converted
   *  purchase order's mandatory vendor. Nullable. */
  vendorUuid?: string;
  paymentTermsId?: number | null;
  salesTaxPercent?: number;
  customFields?: Record<string, unknown>;
  items: RequisitionLineInput[];
}

/** Update takes the same shape as create. Unlike a purchase order — whose
 *  vendor is fixed at creation — a requisition's suggested vendor may be
 *  changed freely while it is still in DRFT. Rejected by the server once the
 *  requisition has left DRFT; recall to draft to edit. */
export type RequisitionUpdatePayload = RequisitionCreatePayload;

// ── Responses (server → client) ──────────────────────────────────────────────

export interface RequisitionVendorRef {
  id: string;
  name: string;
  number?: string;
}

/** A response line carries the frozen snapshot values taken at save time, not
 *  live inventory_item data. */
export interface RequisitionLine {
  id: string;
  lineNumber: number;
  inventoryItemId?: string | null;
  sku: string;
  itemName: string;
  description: string;
  unitCode: string;
  quantity: number;
  estimatedUnitPrice: number;
  estimatedAmount: number;
}

/** `lkp_record_status` codes seeded for the REQN record type. There is no
 *  RJCT status (same as PORD) — rework is expressed as a recall to DRFT. */
export type RequisitionStatusCode = 'DRFT' | 'PAPV' | 'APPV' | 'CANC';

export type RequisitionPriority = 'low' | 'normal' | 'high' | 'urgent';

/** Full detail response (GET/Create/Update/Transition/Approve). Every field
 *  the create/update contract accepts round-trips back here, so the Edit page
 *  can reload a requisition and re-save it without blanking a header field. */
export interface Requisition {
  id: string;
  requisitionNumber: string;
  status: string;                  // human label, e.g. "Draft"
  statusCode: RequisitionStatusCode; // drives the transition button map
  approvalStatus: 'none' | 'pending' | 'approved';

  requestedByEmployeeId: number;
  department: string;
  neededByDate?: string;
  priority: RequisitionPriority;
  memo?: string;

  vendor?: RequisitionVendorRef;
  paymentTermsId: number | null;

  customFields?: Record<string, unknown>;

  salesTaxPercent: number;
  subtotal: number;
  taxTotal: number;
  estimatedTotal: number;

  /** Set once the requisition has been converted; the Detail page links to
   *  this purchase order and hides the Convert action. */
  convertedPurchaseOrderId?: string;

  createdAt?: string;
  updatedAt?: string;
  items: RequisitionLine[];
}

/** List/search rows are full `Requisition` records server-side with `items`
 *  omitted (search selects header columns only, to avoid an N+1 line join) —
 *  this type names the subset the table actually renders. */
export type RequisitionSummary = Pick<
  Requisition,
  | 'id' | 'requisitionNumber' | 'status' | 'statusCode' | 'approvalStatus'
  | 'vendor' | 'department' | 'neededByDate' | 'priority' | 'estimatedTotal'
  | 'requestedByEmployeeId' | 'convertedPurchaseOrderId' | 'createdAt' | 'updatedAt'
>;

/** Search request = the shared `query.Request` plus the optional global-search
 *  term the requisition resolver supports (document number, vendor snapshot
 *  name, memo, department, and line SKU/item name). */
export interface RequisitionSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface RequisitionPage {
  records: RequisitionSummary[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}

/** Convert response. `created` is false when the call was an idempotent
 *  replay against an already-converted requisition — the existing purchase
 *  order is returned rather than a duplicate being made. */
export interface RequisitionConvertResult {
  purchaseOrderId: string;
  purchaseOrderNumber: string;
  created: boolean;
}
