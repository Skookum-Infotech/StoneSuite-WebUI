// Item Receipt form field definitions + form-state <-> payload mapping —
// mirrors lib/purchaseOrderForm.ts's shape, adapted to the Item Receipt
// backend contract (types/itemReceipt.ts). Field keys are UI-facing (mapped
// to the create/update payload via toCreatePayload/toUpdatePayload, not sent
// to the backend verbatim).
import type { CrmLookups } from '@/services/lookupService';
import type { PurchaseOrder, PurchaseOrderLine } from '@/types/purchaseOrder';
import type {
  ItemReceipt, ItemReceiptCreatePayload, ItemReceiptUpdatePayload,
  ItemReceiptLineInput, ItemReceiptLine, ItemReceiptStatusCode,
} from '@/types/itemReceipt';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface ItemReceiptFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'date' | 'readonly';
  required?: boolean;
  lookupKey?: keyof CrmLookups;
  placeholder?: string;
  colSpanFull?: boolean;
  rows?: number;
  hint?: string;
}

// ── Header field definitions ─────────────────────────────────────────────────

export const RECEIPT_HEADER_FIELDS: ItemReceiptFormField[] = [
  { key: 'ir_status', label: 'Item Receipt Status', type: 'readonly', placeholder: 'Pending' },
  { key: 'ir_doc_num', label: 'Item Receipt #', type: 'readonly', placeholder: 'Auto-generated' },
  { key: 'warehouse_name', label: 'Warehouse', type: 'readonly', hint: 'Defaults to the tenant’s default warehouse.' },
  { key: 'receipt_date', label: 'Receipt Date', type: 'date', required: true },
  { key: 'packing_slip', label: 'Packing Slip #', type: 'text', placeholder: 'Enter a packing slip number' },
  { key: 'carrier', label: 'Carrier', type: 'text', placeholder: 'e.g. FedEx, UPS' },
  { key: 'tracking_number', label: 'Tracking #', type: 'text', placeholder: 'Enter a tracking number' },
  { key: 'bill_of_lading', label: 'Bill of Lading #', type: 'text', placeholder: 'Enter a BOL number' },
  { key: 'owner_employee', label: 'Owner', type: 'select', lookupKey: 'employees' },
  { key: 'notes', label: 'Notes', type: 'textarea', placeholder: 'Additional notes…', colSpanFull: true },
  { key: 'internal_notes', label: 'Internal Notes', type: 'textarea', placeholder: 'Notes visible to your team only…', colSpanFull: true },
];

// ── Status catalog ────────────────────────────────────────────────────────────

/** IRCT statuses differ from the PO's eight — a distinct map, never reuse
 *  PO_STATUS_COLORS (spec §5). */
export const IR_STATUS_CODES: { code: ItemReceiptStatusCode; label: string }[] = [
  { code: 'PEND', label: 'Pending' },
  { code: 'PART', label: 'Partial' },
  { code: 'RCVD', label: 'Received' },
  { code: 'VOID', label: 'Void' },
];

export const IR_STATUS_COLORS: Record<string, string> = {
  PEND: '#a8a29e',
  PART: '#f97316',
  RCVD: '#22c55e',
  VOID: '#ef4444',
};

export function irStatusLabel(code: string): string {
  return IR_STATUS_CODES.find((s) => s.code === code)?.label ?? code;
}

/** Editing is PEND-only (itemreceipt/store_update.go). */
export const IR_EDITABLE_STATUSES = new Set<string>(['PEND']);
/** Posting is PEND-only (itemreceipt/store_post.go). */
export const IR_POSTABLE_STATUSES = new Set<string>(['PEND']);
/** Void is legal from PEND/PART/RCVD (itemreceipt/transitions.go); VOID itself is terminal. */
export const IR_VOIDABLE_STATUSES = new Set<string>(['PEND', 'PART', 'RCVD']);
/** Delete is PEND/VOID-only — a posted receipt is the audit trail for stock
 *  that actually moved, so it has to stay (void it first). */
export const IR_DELETABLE_STATUSES = new Set<string>(['PEND', 'VOID']);

// ── Lines: ordered/received/outstanding + editable receiving state ───────────

/** One receiving line in the Receive/Edit form — a merge of a purchase
 *  order's ordered line with (optionally) this receipt's own previously
 *  saved values. `qtyOrdered`/`qtyAlreadyReceived` are read live from the PO
 *  line, exactly like the backend's Line.QtyOrdered/QtyReceivedToDate. */
export interface ItemReceiptDraftLine {
  purchaseOrderItemId: string;
  lineNumber: number;
  inventoryItemId?: string | null;
  itemName: string;
  sku: string;
  description: string;
  unitCode: string;
  qtyOrdered: number;
  /** Cumulative quantity received on this PO line by *other*, already-posted
   *  receipts — excludes this draft's own (unposted) contribution. */
  qtyAlreadyReceived: number;
  qtyReceived: string;
  qtyRejected: string;
  lineNotes: string;
}

function outstandingFor(ordered: number, alreadyReceived: number): number {
  return Math.max(ordered - alreadyReceived, 0);
}

/** Builds the editable line set for a receipt draft: every line on the
 *  source purchase order, each pre-filled from a matching already-saved
 *  receipt line when given (Edit), or defaulted to its outstanding quantity
 *  when not (Receive). Fully-received PO lines are still listed — the user
 *  can still choose to receive against them (e.g. over-receipt) — but
 *  default to a blank qtyReceived so they're excluded unless touched. */
export function mergeReceiptLines(
  poLines: PurchaseOrderLine[],
  existingLines: ItemReceiptLine[] = [],
): ItemReceiptDraftLine[] {
  return poLines.map((po, i) => {
    const existing = existingLines.find((l) => l.purchaseOrderItemId === po.id);
    const outstanding = outstandingFor(po.quantity, po.qtyReceived);
    return {
      purchaseOrderItemId: po.id,
      lineNumber: i + 1,
      inventoryItemId: po.inventoryItemId,
      itemName: existing?.itemName || po.itemName,
      sku: existing?.sku || po.sku,
      description: existing?.description ?? po.description,
      unitCode: existing?.unitCode || po.unitCode,
      qtyOrdered: po.quantity,
      qtyAlreadyReceived: po.qtyReceived,
      qtyReceived: existing ? String(existing.qtyReceived) : (outstanding > 0 ? String(outstanding) : ''),
      qtyRejected: existing ? String(existing.qtyRejected) : '0',
      lineNotes: existing?.lineNotes ?? '',
    };
  });
}

function parsedQty(raw: string): number {
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 0;
}

/** Lines the user has actually entered a received quantity for — the ones
 *  that make it into the submitted payload (itemreceipt/store_create.go
 *  requires qtyReceived > 0 per included line). */
export function includedReceiptLines(lines: ItemReceiptDraftLine[]): ItemReceiptDraftLine[] {
  return lines.filter((l) => parsedQty(l.qtyReceived) > 0);
}

/** A single line's validation failure, keyed back to the PO line it belongs
 *  to — lets ReceiptLinesTable associate the message with its actual row
 *  (`aria-describedby`) instead of only surfacing it in a page-level banner. */
export interface ReceiptLineError {
  purchaseOrderItemId: string;
  lineNumber: number;
  message: string;
}

/** Client-side mirror of store_create.go's resolveLines validation, so a bad
 *  entry surfaces before the round-trip rather than as a raw 400. */
export function validateReceiptLineErrors(lines: ItemReceiptDraftLine[]): ReceiptLineError[] {
  const errors: ReceiptLineError[] = [];
  for (const line of includedReceiptLines(lines)) {
    const received = parsedQty(line.qtyReceived);
    const rejected = parsedQty(line.qtyRejected);
    if (rejected < 0) {
      errors.push({
        purchaseOrderItemId: line.purchaseOrderItemId, lineNumber: line.lineNumber,
        message: 'rejected quantity cannot be negative.',
      });
    } else if (rejected > received) {
      errors.push({
        purchaseOrderItemId: line.purchaseOrderItemId, lineNumber: line.lineNumber,
        message: 'rejected quantity cannot exceed the received quantity.',
      });
    }
  }
  return errors;
}

/** Flattened, page-banner-friendly form of `validateReceiptLineErrors`, plus
 *  the one whole-document check ("at least one line") that has no single row
 *  to attach to. */
export function validateReceiptLines(lines: ItemReceiptDraftLine[]): string[] {
  const errors: string[] = [];
  if (includedReceiptLines(lines).length === 0) {
    errors.push('At least one line item is required.');
  }
  errors.push(...validateReceiptLineErrors(lines).map((e) => `Line ${e.lineNumber}: ${e.message}`));
  return errors;
}

// ── Payload mapping (UI form state -> backend create/update contract) ────────

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

function toIntOrNull(v: unknown): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function toLineInput(line: ItemReceiptDraftLine, lineNo: number): ItemReceiptLineInput {
  return {
    lineNumber: lineNo,
    purchaseOrderItemUuid: line.purchaseOrderItemId,
    qtyReceived: parsedQty(line.qtyReceived),
    qtyRejected: parsedQty(line.qtyRejected),
    lineNotes: line.lineNotes.trim() || undefined,
  };
}

interface ReceiptHeaderFields {
  receiptDate?: string;
  packingSlip?: string;
  carrier?: string;
  trackingNumber?: string;
  billOfLading?: string;
  notes?: string;
  internalNotes?: string;
  ownerEmployeeId: number | null;
  customFields: Record<string, unknown>;
  items: ItemReceiptLineInput[];
}

function toHeaderFields(
  data: Record<string, unknown>,
  lines: ItemReceiptDraftLine[],
  customFields: Record<string, unknown>,
): ReceiptHeaderFields {
  return {
    receiptDate: toStr(data.receipt_date) || undefined,
    packingSlip: toStr(data.packing_slip) || undefined,
    carrier: toStr(data.carrier) || undefined,
    trackingNumber: toStr(data.tracking_number) || undefined,
    billOfLading: toStr(data.bill_of_lading) || undefined,
    notes: toStr(data.notes) || undefined,
    internalNotes: toStr(data.internal_notes) || undefined,
    ownerEmployeeId: toIntOrNull(data.owner_employee),
    customFields,
    items: includedReceiptLines(lines).map((l, i) => toLineInput(l, i + 1)),
  };
}

/** Maps the Receive form's state to the backend's `ItemReceiptCreatePayload`.
 *  `warehouseId` is intentionally never sent — no lookup endpoint exists to
 *  offer an override yet, so every receipt takes the server's tenant default. */
export function toCreatePayload(
  purchaseOrderUuid: string,
  data: Record<string, unknown>,
  lines: ItemReceiptDraftLine[],
  customFields: Record<string, unknown> = {},
): ItemReceiptCreatePayload {
  return { purchaseOrderUuid, ...toHeaderFields(data, lines, customFields) };
}

/** Maps the Edit form's state to the backend's `ItemReceiptUpdatePayload`. */
export function toUpdatePayload(
  data: Record<string, unknown>,
  lines: ItemReceiptDraftLine[],
  customFields: Record<string, unknown> = {},
): ItemReceiptUpdatePayload {
  return toHeaderFields(data, lines, customFields);
}

function idOrEmpty(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

/** Maps a loaded ItemReceipt (GET response) back to the Edit form's header
 *  state — the inverse of toUpdatePayload. Lines are handled separately by
 *  `mergeReceiptLines`, since they need the source PO's live ordered/
 *  received quantities, not just this receipt's own snapshot. */
export function fromItemReceipt(ir: ItemReceipt): {
  data: Record<string, unknown>;
  customFieldValues: Record<string, unknown>;
} {
  return {
    data: {
      ir_status: ir.status,
      ir_doc_num: ir.itemReceiptNumber,
      warehouse_name: ir.warehouseName ?? '',
      receipt_date: ir.receiptDate,
      packing_slip: ir.packingSlip ?? '',
      carrier: ir.carrier ?? '',
      tracking_number: ir.trackingNumber ?? '',
      bill_of_lading: ir.billOfLading ?? '',
      owner_employee: idOrEmpty(ir.ownerEmployeeId),
      notes: ir.notes ?? '',
      internal_notes: ir.internalNotes ?? '',
    },
    customFieldValues: ir.customFields ?? {},
  };
}

export function itemReceiptDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return { receipt_date: today };
}

/** Purchase orders that can be received against — SENT/PART only
 *  (itemreceipt/store.go receivableStatusCodes). Drives which rows the PO
 *  picker offers vs. shows disabled. */
export function isPurchaseOrderReceivable(po: Pick<PurchaseOrder, 'statusCode'>): boolean {
  return po.statusCode === 'SENT' || po.statusCode === 'PART';
}
