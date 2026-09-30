// Item Receipt module — frontend contract types.
//
// Mirrors the dedicated relational Item Receipt backend module
// (`StoneSuite-Backend/itemreceipt/types.go`,
// `docs/superpowers/specs/2026-07-23-item-receipt-module-design.md`). A
// sibling of PurchaseOrder/Estimate — not the generic v1 JSONB CRM router —
// served from `/api/tenant/item-receipts*`. Records goods physically
// arriving against a finalized purchase order; it is the only writer of
// purchase_order_item.qty_received and drives the PO's SENT → PART → RCVD
// rollup.
import type { FilterClause, SortKey } from '@/types/tenant';

// ── Create / update inputs (client → server) ─────────────────────────────────

/** One arriving line. `purchaseOrderItemUuid` is required — a receipt line
 *  always traces back to an ordered PO line (no ad-hoc receiving). Rejected
 *  goods are recorded but never enter stock and never satisfy the order. */
export interface ItemReceiptLineInput {
  lineNumber: number;
  purchaseOrderItemUuid: string;
  qtyReceived: number;
  qtyRejected?: number;
  lineNotes?: string;
  /** Required for a slab-tracked (serialized) item, refused for any other. The
   *  server then computes the line's received quantity from these slabs and
   *  ignores `qtyReceived`; there is no rejected quantity on such a line. */
  slabs?: ItemReceiptSlabInput[];
}

/** One physical slab arriving on a serialized line. The serial is never sent —
 *  the server assigns it when the receipt posts (PO number + running suffix) —
 *  and neither is the area, which it computes from the millimetres. */
export interface ItemReceiptSlabInput {
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  /** Bin uuid; omitted when the slab isn't binned yet. */
  binId?: string;
  blockId?: string;
  lot?: string;
  grade?: string;
  supplierCode?: string;
}

/** GET /purchase-orders/{uuid}/next-slab-serial — how the next slabs received
 *  against this order will be numbered: `prefix` + `next` zero-padded to three
 *  digits. Advisory; the real serials are assigned at post. */
export interface SlabSequence {
  prefix: string;
  next: number;
}

/** Header payload shared by create and update (everything except the
 *  purchase order, which is fixed at creation). `warehouseId` is left
 *  undefined to let the server default to the tenant's default warehouse —
 *  no lookup endpoint exists yet to offer an override. */
export interface ItemReceiptFields {
  receiptDate?: string; // ISO date "yyyy-mm-dd" — defaults to CURRENT_DATE server-side
  warehouseId?: number | null;
  packingSlip?: string;
  carrier?: string;
  trackingNumber?: string;
  billOfLading?: string;
  notes?: string;
  internalNotes?: string;
  ownerEmployeeId?: number | null;
  customFields?: Record<string, unknown>;
  items: ItemReceiptLineInput[];
}

/** The vendor is never accepted from the caller — it's inherited from the
 *  purchase order and snapshotted, so a receipt can never name a different
 *  counterparty than the order it settles. */
export interface ItemReceiptCreatePayload extends ItemReceiptFields {
  purchaseOrderUuid: string;
  /** Create and post in one transaction, so the receipt is never left Pending.
   *  Requires item_receipt:transition on top of :create. A refused post (over-
   *  receipt, order no longer receivable) saves nothing. */
  post?: boolean;
  /** Accompanies `post`, exactly as on the /post payload. */
  overReceiptReason?: string;
}

/** Update mirrors create minus the purchase order (a receipt's source order
 *  is fixed after creation). Rejected by the server once posted — void and
 *  reissue instead. */
export type ItemReceiptUpdatePayload = ItemReceiptFields;

/** POST /post payload. `overReceiptReason` is required when posting exceeds
 *  the tolerance and the caller holds the item_receipt:approve override. */
export interface ItemReceiptPostPayload {
  overReceiptReason?: string;
}

/** POST /void payload. */
export interface ItemReceiptVoidPayload {
  voidReason: string;
}

// ── Responses (server → client) ──────────────────────────────────────────────

export interface ItemReceiptVendorRef {
  id: string;
  name: string;
  number?: string;
}

export interface ItemReceiptPurchaseOrderRef {
  id: string;
  number?: string;
  statusCode?: string;
}

/** `lkp_record_status` code for the IRCT record type. */
export type ItemReceiptStatusCode = 'PEND' | 'PART' | 'RCVD' | 'VOID';

/** One received line in the API response. `qtyOrdered` and
 *  `qtyReceivedToDate` are read live from the source PO line as progress
 *  indicators, not part of this document's own frozen snapshot — they move
 *  as later receipts post. */
export interface ItemReceiptLine {
  id: string;
  lineNumber: number;
  purchaseOrderItemId: string;
  inventoryItemId?: string | null;
  sku: string;
  itemName: string;
  description: string;
  unitCode: string;
  qtyReceived: number;
  qtyRejected: number;
  qtyOrdered: number;
  qtyReceivedToDate: number;
  lineNotes?: string;
  /** Present only on a serialized line. */
  slabs?: ItemReceiptLineSlab[];
}

/** A slab on a received line. `serial`, `unitId` and `unitStatus` stay empty
 *  until the receipt posts; `unitStatus` is then the slab's LIVE inventory
 *  status (it may have been reserved, cut or scrapped since). */
export interface ItemReceiptLineSlab {
  serial?: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  area: number;
  binId?: string | null;
  binPath?: string;
  blockId?: string;
  lot?: string;
  grade?: string;
  supplierCode?: string;
  unitId?: string | null;
  unitStatus?: string;
}

// Full detail response (GET/Create/Update/Post/Void/Transition). Every field
// the create/update contract accepts round-trips back here too.
export interface ItemReceipt {
  id: string;
  itemReceiptNumber: string;
  status: string;                     // human label, e.g. "Pending"
  statusCode: ItemReceiptStatusCode;  // drives the transition/action button map
  purchaseOrder: ItemReceiptPurchaseOrderRef;
  vendor: ItemReceiptVendorRef;

  warehouseId: number;
  warehouseName?: string;
  receiptDate: string;
  packingSlip?: string;
  carrier?: string;
  trackingNumber?: string;
  billOfLading?: string;
  notes?: string;
  internalNotes?: string;

  ownerEmployeeId: number | null;

  postedAt?: string;
  voidedAt?: string;
  voidReason?: string;
  overReceiptReason?: string;

  customFields?: Record<string, unknown>;

  createdAt: string;
  updatedAt: string;
  items?: ItemReceiptLine[];
}

/** Search request = the shared `query.Request` plus the optional global
 *  search term (receipt number, packing slip/tracking/BOL, carrier, vendor
 *  name, PO number, line SKU/name). */
export interface ItemReceiptSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface ItemReceiptPage {
  records: ItemReceipt[];
  nextCursor: string;
  hasMore: boolean;
  scope: string;
}
