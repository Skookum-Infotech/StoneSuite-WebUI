// Vendor Bill form field definitions — mirrors lib/purchaseOrderForm.ts's
// shape, adapted to the Vendor Bill backend contract (types/vendorBill.ts).
// Field keys are UI-facing (mapped to the create/update payload via
// toCreatePayload, not sent to the backend verbatim). Unlike Purchase Order,
// a vendor bill has no shipping/address block.

import type { CrmLookups } from '@/services/lookupService';
import type { FieldDefinition } from '@/types/tenant';
import type {
  VendorBill, CreateVendorBillPayload, VendorBillLineInput, VendorBillLine,
} from '@/types/vendorBill';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface VendorBillFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'readonly';
  required?: boolean;
  lookupKey?: keyof CrmLookups;
  placeholder?: string;
  colSpanFull?: boolean;
  rows?: number;
  hint?: string;
  min?: number;
  max?: number;
}

// ── Form section field definitions ───────────────────────────────────────────

export const PRIMARY_INFO_FIELDS: VendorBillFormField[] = [
  {
    key: 'vb_status',
    label: 'Vendor Bill Status',
    type: 'readonly',
    placeholder: 'Draft',
  },
  {
    key: 'vb_doc_num',
    label: 'Vendor Bill #',
    type: 'readonly',
    placeholder: 'Auto-generated',
  },
  {
    key: 'vendor_invoice_number',
    label: "Vendor's Invoice #",
    type: 'text',
    placeholder: "The vendor's own invoice number",
  },
  {
    key: 'reference_number',
    label: 'Reference #',
    type: 'text',
    placeholder: 'Enter a reference number',
  },
  {
    key: 'bill_date',
    label: 'Bill Date',
    type: 'date',
    required: true,
  },
  {
    key: 'due_date',
    label: 'Due Date',
    type: 'date',
  },
  {
    key: 'payment_terms',
    label: 'Payment Terms',
    type: 'select',
    lookupKey: 'paymentTerms',
  },
  {
    key: 'currency_id',
    label: 'Currency',
    type: 'select',
    lookupKey: 'currencies',
  },
  {
    key: 'sales_tax_pct',
    label: 'Sales Tax %',
    type: 'number',
    placeholder: '0.00',
    min: 0,
    max: 100,
  },
  {
    key: 'owner_employee',
    label: 'Owner',
    type: 'select',
    lookupKey: 'employees',
  },
  {
    key: 'adjustment',
    label: 'Adjustment',
    type: 'number',
    placeholder: '0.00',
  },
  {
    key: 'memo',
    label: 'Memo',
    type: 'textarea',
    placeholder: 'Notes related to this bill…',
    colSpanFull: true,
  },
  {
    key: 'notes',
    label: 'Notes',
    type: 'textarea',
    placeholder: 'Additional notes…',
    colSpanFull: true,
  },
  {
    key: 'internal_notes',
    label: 'Internal Notes',
    type: 'textarea',
    placeholder: 'Notes visible to your team only…',
    colSpanFull: true,
  },
  {
    key: 'terms_conditions',
    label: 'Terms & Conditions',
    type: 'textarea',
    placeholder: 'Terms and conditions for this bill…',
    colSpanFull: true,
  },
];

// ── Items sub-tab ─────────────────────────────────────────────────────────────

// A line is either a catalog pick (inventoryItemUuid; server snapshots sku/
// name/unit/price/tax) or free text — mirrors PurchaseOrderLineItem. taxRateId
// is accepted by the backend but has no lookup UI yet (matches every other
// sales/purchases module), so every line's tax preview follows the header's
// Sales Tax % rather than a per-line rate.
export interface VendorBillLineItem {
  id: string;
  lineNo: number;
  itemName: string;
  itemDescription: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  amount: string;   // calculated: round2(round2(qty*price) - round2(subtotal*disc%))
  total: string;     // calculated: round2(amount + round2(amount*headerTaxPercent%))
  /** Catalog reference — set when the line was picked from the inventory
   *  catalog (maps to the create payload's `inventoryItemUuid`). Absent for
   *  free-text lines. Display-only sku/units below come from the pick. */
  inventoryItemUuid?: string;
  itemSku?: string;
  units?: string;
  /** Read-only lineage — set only when this line came from a purchase-order
   *  convert; never sent back to the server (there is no input field for it). */
  purchaseOrderItemId?: string | null;
}

export const EMPTY_LINE_ITEM: Omit<VendorBillLineItem, 'id' | 'lineNo'> = {
  itemName: '',
  itemDescription: '',
  quantity: '',
  unitPrice: '',
  discount: '0',
  amount: '',
  total: '',
};

/** Clamps a percent field (discount) to [0, 100] as the user types, mirroring
 *  the backend's range check. Needed because rows in the items table commit
 *  via a button click, not a native form submit, so an `<input min max>`
 *  alone never blocks an out-of-range value. */
export function clampPercent(raw: string): string {
  if (raw === '') return raw;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return raw;
  const clamped = Math.min(100, Math.max(0, n));
  return clamped === n ? raw : String(clamped);
}

/** Rounds to 2 decimal places — mirrors the backend's `round2`. */
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

export interface LineMoneyBreakdown {
  subtotal: number;    // round2(qty * price) — gross, before discount
  discountAmt: number; // round2(subtotal * disc%)
  amount: number;       // round2(subtotal - discountAmt) — net of discount, pre-tax
  tax: number;          // round2(amount * headerTaxPercent%)
  total: number;        // round2(amount + tax)
}

/** Client-side preview of a line's money, replicating the backend's
 *  stepwise round2 math exactly (mirrors purchaseOrderForm.ts's
 *  calcLineBreakdown). Server totals are authoritative; this only drives the
 *  live preview. Single source of truth for both the items grid
 *  (calcLineItem) and the header summary totals. */
export function calcLineBreakdown(
  item: Pick<VendorBillLineItem, 'quantity' | 'unitPrice' | 'discount'>,
  headerTaxPercent: number,
): LineMoneyBreakdown {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unitPrice) || 0;
  const disc = parseFloat(item.discount) || 0;
  const subtotal = round2(qty * price);
  const discountAmt = round2(subtotal * (disc / 100));
  const amount = round2(subtotal - discountAmt);
  const tax = round2(amount * ((headerTaxPercent || 0) / 100));
  const total = round2(amount + tax);
  return { subtotal, discountAmt, amount, tax, total };
}

/** Display-string variant of `calcLineBreakdown` for the items grid — blank
 *  (not "0.00") until both quantity and price are entered. */
export function calcLineItem(
  item: Pick<VendorBillLineItem, 'quantity' | 'unitPrice' | 'discount'>,
  headerTaxPercent: number,
): { amount: string; total: string } {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unitPrice) || 0;
  const { amount, total } = calcLineBreakdown(item, headerTaxPercent);
  return {
    amount: qty && price ? amount.toFixed(2) : '',
    total: qty && price ? total.toFixed(2) : '',
  };
}

/** Header totals aggregated from every line's breakdown, mirroring the
 *  backend's header computation: sums are rounded once more after summing
 *  (lines are already 2dp, so this is a no-op in practice, but keeps the
 *  client's math shaped exactly like the server's). No shipping charge —
 *  vendor bills don't carry one. */
export function calcHeaderTotals(
  lineItems: Pick<VendorBillLineItem, 'quantity' | 'unitPrice' | 'discount'>[],
  headerTaxPercent: number,
  adjustment: number,
): { subtotal: number; discountAmt: number; taxTotal: number; total: number } {
  let subtotal = 0, discountAmt = 0, taxTotal = 0;
  for (const item of lineItems) {
    const b = calcLineBreakdown(item, headerTaxPercent);
    subtotal += b.subtotal;
    discountAmt += b.discountAmt;
    taxTotal += b.tax;
  }
  subtotal = round2(subtotal);
  discountAmt = round2(discountAmt);
  taxTotal = round2(taxTotal);
  const total = round2(subtotal - discountAmt + taxTotal + adjustment);
  return { subtotal, discountAmt, taxTotal, total };
}

// ── Status catalog (backend spec AD-5 — invoice's machine minus SENT) ────────

/** Every `lkp_record_status` row seeded for the VBIL record type. The backend
 *  (`vendorbill.ValidateTransition`) is the source of truth for which moves
 *  are actually legal from a given status — this list only drives display
 *  labels; an illegal pick is rejected server-side with a 409. */
export const VB_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'PAPV', label: 'Pending Approval' },
  { code: 'APPV', label: 'Approved' },
  { code: 'PART', label: 'Partially Paid' },
  { code: 'ODUE', label: 'Overdue' },
  { code: 'PAID', label: 'Paid' },
  { code: 'VOID', label: 'Void' },
];

/** Legal next-moves per status — mirrors the backend
 *  vendorbill/transitions.go `allowedTransitions` map (spec AD-5): invoice's
 *  machine minus SENT (a bill is received, not sent). PART/PAID are normally
 *  reached automatically by RecordPayment's balance recompute, not a manual
 *  transition — they stay in the map (and this UI) so an operator can
 *  correct state by hand. Terminal statuses (PAID, VOID) map to an empty
 *  list. The backend stays authoritative; an illegal pick is rejected with
 *  409, so this only keeps the UI from offering one. */
export const VB_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRFT: ['PAPV', 'VOID'],
  PAPV: ['APPV', 'DRFT', 'VOID'],
  APPV: ['PART', 'PAID', 'ODUE', 'VOID'],
  PART: ['PAID', 'ODUE', 'VOID'],
  ODUE: ['PART', 'PAID', 'VOID'],
  PAID: [],
  VOID: [],
};

/** Button label per (from, to) status-code pair — a plain `to`-keyed map
 *  can't distinguish contexts that share a target code, so the key is
 *  `${from}:${to}` (mirrors PO_TRANSITION_LABELS). */
export const VB_TRANSITION_LABELS: Record<string, string> = {
  'DRFT:PAPV': 'Submit for Approval',
  'DRFT:VOID': 'Void',
  'PAPV:APPV': 'Approve & Advance',
  'PAPV:DRFT': 'Recall to Draft',
  'PAPV:VOID': 'Void',
  'APPV:PART': 'Mark Partially Paid',
  'APPV:PAID': 'Mark Paid',
  'APPV:ODUE': 'Mark Overdue',
  'APPV:VOID': 'Void',
  'PART:PAID': 'Mark Paid',
  'PART:ODUE': 'Mark Overdue',
  'PART:VOID': 'Void',
  'ODUE:PART': 'Mark Partially Paid',
  'ODUE:PAID': 'Mark Paid',
  'ODUE:VOID': 'Void',
};

export function vbTransitionLabel(from: string, to: string): string {
  return VB_TRANSITION_LABELS[`${from}:${to}`] ?? to;
}

/** Human label for a status code (e.g. "PAPV" -> "Pending Approval") — used
 *  by the transition confirmation dialog. Falls back to the raw code for an
 *  unrecognized one rather than throwing. */
export function vbStatusLabel(code: string): string {
  return VB_STATUS_CODES.find((s) => s.code === code)?.label ?? code;
}

/** AD-6 approval gate (vendorbill/store_transition.go): once a status
 *  requires approval, every move away from it is blocked except the recall
 *  back to DRFT — until `approvalStatus` reaches "approved". Mirrors
 *  isPoTransitionBlocked. */
export function isVbTransitionBlocked(toCode: string, approvalStatus: string): boolean {
  return toCode !== 'DRFT' && approvalStatus === 'pending';
}

/** Status badge color, keyed by status code (VBIL statuses are fixed/seeded,
 *  mirrors PO_STATUS_COLORS). */
export const VB_STATUS_COLORS: Record<string, string> = {
  DRFT: '#a8a29e',
  PAPV: '#f59e0b',
  APPV: '#3b82f6',
  PART: '#f59e0b',
  ODUE: '#ef4444',
  PAID: '#10b981',
  VOID: '#78716c',
};

/** Statuses a vendor payment can be applied against (vendorbill/balance.go
 *  `PayableStatuses`) — a bill must be approved before anything can be paid
 *  against it. The bill itself no longer records settlements: the check runs
 *  server-side inside `vendorpayment.Apply`, and this set only drives UI copy
 *  (see VP_PAYABLE_BILL_STATUSES in lib/vendorPaymentForm.ts). */
export const VB_PAYABLE_STATUSES = new Set(['APPV', 'PART', 'ODUE']);

/** Statuses `vendorBillService.updateVendorBill` rejects edits against
 *  (vendorbill/store_update.go — editing is DRFT-only). */
export const VB_NON_DRAFT_LOCKED = (statusCode: string): boolean => statusCode !== 'DRFT';

/** Statuses from which Delete is offered (vendorbill/store_delete.go — delete
 *  is DRFT/VOID only). */
export const VB_DELETABLE_STATUSES = new Set(['DRFT', 'VOID']);

// ── Form defaults ─────────────────────────────────────────────────────────────

export function vendorBillDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    bill_date: today,
    vb_status: 'Draft',
    sales_tax_pct: '0',
    adjustment: '0',
  };
}

// ── Payload mapping (UI form state -> backend create contract) ───────────────

function toNum(v: unknown, fallback = 0): number {
  const n = parseFloat(String(v ?? ''));
  return Number.isFinite(n) ? n : fallback;
}

function toIntOrNull(v: unknown): number | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

/** Maps one editable line row to the create/update contract's line shape. An
 *  explicit `itemDescription` always wins (overrides a catalog item's own
 *  description, or supplies detail for a free-text line); otherwise a
 *  catalog line (`inventoryItemUuid` set) sends no description — the server
 *  snapshots the catalog item's own — while a free-text line falls back to
 *  `itemName`, since the backend requires a description there (mirrors
 *  purchaseOrderForm.ts's toLineInput). */
function toLineInput(item: VendorBillLineItem, lineNo: number): VendorBillLineInput {
  return {
    lineNumber: lineNo,
    inventoryItemUuid: item.inventoryItemUuid || undefined,
    description: (item.itemDescription || '').trim()
      || (item.inventoryItemUuid ? undefined : (item.itemName || undefined)),
    quantity: toNum(item.quantity),
    unitPrice: toNum(item.unitPrice),
    discountPercent: toNum(item.discount),
  };
}

/** Maps the AddVendorBillPage form state + line items to the backend's
 *  `CreateVendorBillPayload`. `vendorUuid` comes from the VendorPicker's
 *  selection (stored under `vendor_uuid` in form state). Status is
 *  intentionally omitted: every new vendor bill starts at DRFT
 *  server-side; status changes go through the `/transition` endpoint. */
export function toCreatePayload(
  data: Record<string, unknown>,
  lineItems: VendorBillLineItem[],
  customFields: Record<string, unknown> = {},
): CreateVendorBillPayload {
  return {
    vendorUuid: toStr(data.vendor_uuid),
    vendorInvoiceNumber: toStr(data.vendor_invoice_number),
    referenceNumber: toStr(data.reference_number),
    billDate: toStr(data.bill_date),
    dueDate: toStr(data.due_date) || undefined,
    paymentTermsId: toIntOrNull(data.payment_terms),
    currencyId: toIntOrNull(data.currency_id),
    ownerEmployeeId: toIntOrNull(data.owner_employee),
    salesTaxPercent: toNum(data.sales_tax_pct),
    memo: toStr(data.memo),
    notes: toStr(data.notes),
    internalNotes: toStr(data.internal_notes),
    termsConditions: toStr(data.terms_conditions),
    adjustment: toNum(data.adjustment),
    customFields,
    items: lineItems.map((item, i) => toLineInput(item, i + 1)),
  };
}

/** id-or-empty for a lookupKey <select>'s bound value: null/undefined must
 *  render as "— Select —" (empty string), never "0" or "null". */
function idOrEmpty(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

function fromLine(line: VendorBillLine, i: number): VendorBillLineItem {
  return {
    id: `existing-${i}`,
    lineNo: line.lineNumber,
    // Free-text lines saved before the backend snapshotted item_name from the
    // description round-trip with an empty itemName — fall back to
    // description so the Edit page doesn't reject the line as having neither
    // a catalog item nor a name (mirrors purchaseOrderForm.ts's fromLine).
    itemName: line.itemName || line.description,
    itemDescription: line.description ?? '',
    itemSku: line.sku,
    units: line.unitCode,
    quantity: String(line.quantity),
    unitPrice: String(line.unitPrice),
    discount: String(line.discountPercent),
    amount: (line.lineSubtotal - line.lineDiscount).toFixed(2),
    total: line.lineTotal.toFixed(2),
    inventoryItemUuid: line.inventoryItemId ?? undefined,
    purchaseOrderItemId: line.purchaseOrderItemId ?? undefined,
  };
}

/** Maps a loaded VendorBill (GET response) back to the Edit form's state —
 *  the inverse of toCreatePayload. Vendor is returned separately since it's
 *  driven by VendorPicker's own state, not a plain form field. */
export function fromVendorBill(bill: VendorBill): {
  data: Record<string, unknown>;
  lineItems: VendorBillLineItem[];
  vendor: { id: string; name: string };
  customFieldValues: Record<string, unknown>;
} {
  const data: Record<string, unknown> = {
    vb_status: bill.status,
    vb_doc_num: bill.vendorBillNumber,
    vendor_invoice_number: bill.vendorInvoiceNumber ?? '',
    reference_number: bill.referenceNumber ?? '',
    bill_date: bill.billDate,
    due_date: bill.dueDate ?? '',
    payment_terms: idOrEmpty(bill.paymentTermsId),
    currency_id: idOrEmpty(bill.currencyId),
    sales_tax_pct: String(bill.salesTaxPercent ?? 0),
    owner_employee: idOrEmpty(bill.ownerEmployeeId),
    adjustment: String(bill.adjustment ?? 0),
    memo: bill.memo ?? '',
    notes: bill.notes ?? '',
    internal_notes: bill.internalNotes ?? '',
    terms_conditions: bill.termsConditions ?? '',
  };

  const lineItems: VendorBillLineItem[] = bill.items.map(fromLine);

  return {
    data,
    lineItems,
    vendor: { id: bill.vendor.id, name: bill.vendor.name },
    customFieldValues: bill.customFields ?? {},
  };
}

/** Required-field check for the vendor_bill workflow's custom field
 *  definitions (rendered via DynamicFieldInput) — mirrors
 *  purchaseOrderForm.ts's validatePurchaseOrderCustomFields. */
export function validateVendorBillCustomFields(
  defs: FieldDefinition[],
  values: Record<string, unknown>,
): { key: string; label: string }[] {
  const errors: { key: string; label: string }[] = [];
  for (const def of defs) {
    if (!def.required) continue;
    const val = values[def.key];
    if (val === undefined || val === null || val === '') {
      errors.push({ key: def.key, label: def.label });
    }
  }
  return errors;
}
