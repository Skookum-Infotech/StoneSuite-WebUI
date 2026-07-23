// Purchase Order form field definitions — mirrors lib/estimateForm.ts's
// shape, adapted to the Purchase Order backend contract
// (types/purchaseOrder.ts). Field keys are UI-facing (mapped to the
// create/update payload via toCreatePayload, not sent to the backend
// verbatim).

import type { CrmLookups } from '@/services/lookupService';
import type { FieldDefinition } from '@/types/tenant';
import type {
  PurchaseOrder, PurchaseOrderCreatePayload, PurchaseOrderLineInput, PurchaseOrderLine,
} from '@/types/purchaseOrder';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface PurchaseOrderFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'email' | 'tel' | 'number' | 'date' | 'readonly';
  required?: boolean;
  options?: string[];
  /** When set, options are sourced from CrmLookups[lookupKey] (id/name pairs)
   *  instead of the static `options` string list — the field's value becomes
   *  the lookup row's numeric id (as a string), matching the create payload's
   *  *Id fields. */
  lookupKey?: keyof CrmLookups;
  /** For a lookupKey field whose rows carry a `countryId` (states): only show
   *  options where countryId matches the value of this other field. */
  dependsOn?: string;
  placeholder?: string;
  /** Span two grid columns */
  colSpan2?: boolean;
  /** Span all grid columns */
  colSpanFull?: boolean;
  /** Textarea row count (only used when type === 'textarea') */
  rows?: number;
  /** Small helper line rendered under the field */
  hint?: string;
  /** Native min/max for type: 'number' fields */
  min?: number;
  max?: number;
}

// ── Form section field definitions ───────────────────────────────────────────

export const PRIMARY_INFO_FIELDS: PurchaseOrderFormField[] = [
  {
    key: 'po_status',
    label: 'Purchase Order Status',
    type: 'readonly',
    placeholder: 'Draft',
  },
  {
    key: 'po_doc_num',
    label: 'Purchase Order #',
    type: 'readonly',
    placeholder: 'Auto-generated',
  },
  {
    key: 'reference_number',
    label: 'Reference #',
    type: 'text',
    placeholder: 'Enter a reference number',
  },
  {
    key: 'order_date',
    label: 'Order Date',
    type: 'date',
    required: true,
  },
  {
    key: 'expected_date',
    label: 'Expected Date',
    type: 'date',
    hint: 'When you expect the vendor to deliver.',
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
    key: 'shipping_charge',
    label: 'Shipping Charge',
    type: 'number',
    placeholder: '0.00',
    min: 0,
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
    placeholder: 'Notes related to this purchase order…',
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
    placeholder: 'Terms and conditions for this order…',
    colSpanFull: true,
  },
];

// A purchase order carries a single ship-to (deliver-to) address — no
// billing block (the bill-to is the tenant itself) and no "same as billing"
// toggle, unlike Estimate/Quote/Invoice/SalesOrder.
export const SHIP_TO_FIELDS: PurchaseOrderFormField[] = [
  {
    key: 'ship_name',
    label: 'Deliver To',
    type: 'text',
    placeholder: 'Receiving location name',
  },
  {
    key: 'ship_attn',
    label: 'Attn:',
    type: 'text',
    placeholder: 'Authorized contact person',
  },
  {
    key: 'ship_address1',
    label: 'Address Line 1',
    type: 'textarea',
    rows: 2,
    colSpan2: true,
    placeholder: '123 Main Street',
  },
  {
    key: 'ship_address2',
    label: 'Address Line 2',
    type: 'textarea',
    rows: 2,
    colSpan2: true,
    placeholder: 'Apt, suite, floor, etc.',
  },
  {
    key: 'ship_suite',
    label: 'Suite / Unit #',
    type: 'text',
    placeholder: 'Suite 100',
  },
  { key: 'ship_city', label: 'City', type: 'text', placeholder: 'City' },
  { key: 'ship_country', label: 'Country', type: 'select', lookupKey: 'countries' },
  { key: 'ship_state', label: 'State', type: 'select', lookupKey: 'states', dependsOn: 'ship_country' },
  {
    key: 'ship_zip',
    label: 'Zip / Postal Code',
    type: 'text',
    placeholder: '12345',
  },
  {
    key: 'ship_phone',
    label: 'Phone',
    type: 'tel',
    placeholder: '+1 (555) 000-0000',
  },
  {
    key: 'ship_fax',
    label: 'Fax',
    type: 'tel',
    placeholder: '+1 (555) 000-0000',
  },
  {
    key: 'ship_email',
    label: 'Email',
    type: 'email',
    placeholder: 'receiving@company.com',
  },
];

// ── Items sub-tab ─────────────────────────────────────────────────────────────

// A line is either a catalog pick (inventoryItemUuid; server snapshots sku/
// name/unit/price/tax) or free text — mirrors EstimateLineItem. taxRateId is
// accepted by the backend but has no lookup UI yet (lkp_tax_rate has a single
// seeded "No Tax" row and no endpoint exposes it — matches Estimate/Quote/
// Invoice/SalesOrder), so every line's tax preview follows the header's
// Sales Tax % rather than a per-line rate.
export interface PurchaseOrderLineItem {
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
}

export const EMPTY_LINE_ITEM: Omit<PurchaseOrderLineItem, 'id' | 'lineNo'> = {
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

/** Rounds to 2 decimal places — mirrors the backend's `round2` (purchaseorder/
 *  calc.go), so the client-side preview matches the server's stepwise math. */
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
 *  `ComputeLine` exactly (spec AD-7): subtotal and discount are each rounded
 *  to 2dp before the next step, then tax and total follow the same rule.
 *  Uses the header's Sales Tax % (no per-line tax override UI — see
 *  PurchaseOrderLineItem doc). Server totals are authoritative; this only
 *  drives the live preview. Single source of truth for both the items grid
 *  (calcLineItem) and the header summary totals (see Add/EditPurchaseOrderPage). */
export function calcLineBreakdown(
  item: Pick<PurchaseOrderLineItem, 'quantity' | 'unitPrice' | 'discount'>,
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
  item: Pick<PurchaseOrderLineItem, 'quantity' | 'unitPrice' | 'discount'>,
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
 *  backend's `ComputeHeader` (purchaseorder/calc.go): sums are rounded once
 *  more after summing (lines are already 2dp, so this is a no-op in
 *  practice, but keeps the client's math shaped exactly like the server's). */
export function calcHeaderTotals(
  lineItems: Pick<PurchaseOrderLineItem, 'quantity' | 'unitPrice' | 'discount'>[],
  headerTaxPercent: number,
  shippingCharge: number,
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
  const total = round2(subtotal - discountAmt + taxTotal + shippingCharge + adjustment);
  return { subtotal, discountAmt, taxTotal, total };
}

// ── Status catalog (backend spec AD-5 — mostly forward-only state machine) ───

/** Every `lkp_record_status` row seeded for the PORD record type. The backend
 *  (`purchaseorder.ValidateTransition`) is the source of truth for which
 *  moves are actually legal from a given status — this list only drives
 *  display labels; an illegal pick is rejected server-side with a 409. */
export const PO_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'PAPV', label: 'Pending Approval' },
  { code: 'APPV', label: 'Approved' },
  { code: 'SENT', label: 'Sent' },
  { code: 'PART', label: 'Partially Received' },
  { code: 'RCVD', label: 'Received' },
  { code: 'CLSD', label: 'Closed' },
  { code: 'CANC', label: 'Cancelled' },
];

/** Legal next-moves per status — mirrors the backend
 *  purchaseorder/transitions.go `allowedTransitions` map (spec AD-5).
 *  Terminal statuses (CLSD, CANC) map to an empty list. The backend
 *  (ValidateTransition) stays authoritative; an illegal pick is rejected
 *  with 409, so this only keeps the UI from offering one. */
export const PO_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRFT: ['PAPV', 'CANC'],
  PAPV: ['APPV', 'DRFT', 'CANC'],
  APPV: ['SENT', 'DRFT', 'CANC'],
  SENT: ['PART', 'RCVD', 'CLSD', 'CANC'],
  PART: ['RCVD', 'CLSD'],
  RCVD: ['CLSD'],
  CLSD: [],
  CANC: [],
};

/** Button label per (from, to) status-code pair (spec §2) — a plain
 *  `to`-keyed map can't distinguish "Recall to Draft" (PAPV→DRFT) from
 *  "Revise" (APPV→DRFT), so the key is `${from}:${to}`. */
export const PO_TRANSITION_LABELS: Record<string, string> = {
  'DRFT:PAPV': 'Submit for Approval',
  'DRFT:CANC': 'Cancel',
  'PAPV:APPV': 'Approve & Advance',
  'PAPV:DRFT': 'Recall to Draft',
  'PAPV:CANC': 'Cancel',
  'APPV:SENT': 'Send to Vendor',
  'APPV:DRFT': 'Revise',
  'APPV:CANC': 'Cancel',
  'SENT:PART': 'Mark Partially Received',
  'SENT:RCVD': 'Mark Received',
  'SENT:CLSD': 'Short-Close',
  'SENT:CANC': 'Cancel',
  'PART:RCVD': 'Mark Received',
  'PART:CLSD': 'Short-Close',
  'RCVD:CLSD': 'Close',
};

export function poTransitionLabel(from: string, to: string): string {
  return PO_TRANSITION_LABELS[`${from}:${to}`] ?? to;
}

/** Human label for a status code (e.g. "PAPV" -> "Pending Approval") — used
 *  by the transition confirmation dialog. Falls back to the raw code for an
 *  unrecognized one rather than throwing. */
export function poStatusLabel(code: string): string {
  return PO_STATUS_CODES.find((s) => s.code === code)?.label ?? code;
}

/** AD-6 approval gate (purchaseorder/store_transition.go): once a status
 *  requires approval, every move away from it is blocked except the recall
 *  back to DRFT — until `approvalStatus` reaches "approved". Recalling to
 *  draft is always allowed (it's how a submitter withdraws a pending order
 *  for rework without an approver's sign-off). */
export function isPoTransitionBlocked(toCode: string, approvalStatus: string): boolean {
  return toCode !== 'DRFT' && approvalStatus === 'pending';
}

/** Status badge color (spec §2) — shared by the list table, detail page, and
 *  transition bar. Keyed by status code (PORD statuses are fixed/seeded, so
 *  unlike Estimate this doesn't need to key off the human label). */
export const PO_STATUS_COLORS: Record<string, string> = {
  DRFT: '#a8a29e',
  PAPV: '#f59e0b',
  APPV: '#3b82f6',
  SENT: '#6366f1',
  PART: '#f97316',
  RCVD: '#22c55e',
  CLSD: '#64748b',
  CANC: '#ef4444',
};

/** Statuses `purchaseOrderService.updatePurchaseOrder` rejects edits against
 *  (purchaseorder/store_update.go — editing is DRFT-only; recall to draft to
 *  revise, since a PO is an outward commitment once submitted). */
export const PO_NON_DRAFT_LOCKED = (statusCode: string): boolean => statusCode !== 'DRFT';

/** Statuses from which Delete is offered (purchaseorder/store.go — delete is
 *  DRFT/CANC only). */
export const PO_DELETABLE_STATUSES = new Set(['DRFT', 'CANC']);

// ── Form defaults ─────────────────────────────────────────────────────────────

export function purchaseOrderDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    order_date: today,
    po_status: 'Draft',
    sales_tax_pct: '0',
    shipping_charge: '0',
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
 *  estimateForm.ts's toLineInput / purchaseorder/store_create.go resolveLines). */
function toLineInput(item: PurchaseOrderLineItem, lineNo: number): PurchaseOrderLineInput {
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

/** Maps the AddPurchaseOrderPage form state + line items to the backend's
 *  `PurchaseOrderCreatePayload`. `vendorUuid` comes from the VendorPicker's
 *  selection (stored under `vendor_uuid` in form state) — the free-text
 *  ship-to display name is sent as-is, only the vendor reference is an id.
 *  Status is intentionally omitted: every new purchase order starts at DRFT
 *  server-side; status changes go through the `/transition` endpoint. */
export function toCreatePayload(
  data: Record<string, unknown>,
  lineItems: PurchaseOrderLineItem[],
  customFields: Record<string, unknown> = {},
): PurchaseOrderCreatePayload {
  return {
    vendorUuid: toStr(data.vendor_uuid),
    referenceNumber: toStr(data.reference_number),
    orderDate: toStr(data.order_date),
    expectedDate: toStr(data.expected_date) || undefined,
    paymentTermsId: toIntOrNull(data.payment_terms),
    currencyId: toIntOrNull(data.currency_id),
    ownerEmployeeId: toIntOrNull(data.owner_employee),
    salesTaxPercent: toNum(data.sales_tax_pct),
    memo: toStr(data.memo),
    notes: toStr(data.notes),
    internalNotes: toStr(data.internal_notes),
    termsConditions: toStr(data.terms_conditions),
    shipTo: {
      name: toStr(data.ship_name),
      attention: toStr(data.ship_attn),
      addrLine1: toStr(data.ship_address1),
      addrLine2: toStr(data.ship_address2),
      suiteUnit: toStr(data.ship_suite),
      city: toStr(data.ship_city),
      stateId: toIntOrNull(data.ship_state),
      countryId: toIntOrNull(data.ship_country),
      zip: toStr(data.ship_zip),
      phone: toStr(data.ship_phone),
      fax: toStr(data.ship_fax),
      email: toStr(data.ship_email),
    },
    shippingCharge: toNum(data.shipping_charge),
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

function fromLine(line: PurchaseOrderLine, i: number): PurchaseOrderLineItem {
  return {
    id: `existing-${i}`,
    lineNo: line.lineNumber,
    // Free-text lines saved before the backend snapshotted item_name from the
    // description round-trip with an empty itemName — fall back to
    // description so the Edit page doesn't reject the line as having neither
    // a catalog item nor a name (mirrors estimateForm.ts's fromEstimate).
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
  };
}

/** Maps a loaded PurchaseOrder (GET response) back to the Edit form's state —
 *  the inverse of toCreatePayload. Vendor is returned separately since it's
 *  driven by VendorPicker's own state, not a plain form field. */
export function fromPurchaseOrder(po: PurchaseOrder): {
  data: Record<string, unknown>;
  lineItems: PurchaseOrderLineItem[];
  vendor: { id: string; name: string };
  customFieldValues: Record<string, unknown>;
} {
  const data: Record<string, unknown> = {
    po_status: po.status,
    po_doc_num: po.purchaseOrderNumber,
    reference_number: po.referenceNumber ?? '',
    order_date: po.orderDate,
    expected_date: po.expectedDate ?? '',
    payment_terms: idOrEmpty(po.paymentTermsId),
    currency_id: idOrEmpty(po.currencyId),
    sales_tax_pct: String(po.salesTaxPercent ?? 0),
    owner_employee: idOrEmpty(po.ownerEmployeeId),
    shipping_charge: String(po.shippingCharge ?? 0),
    adjustment: String(po.adjustment ?? 0),
    memo: po.memo ?? '',
    notes: po.notes ?? '',
    internal_notes: po.internalNotes ?? '',
    terms_conditions: po.termsConditions ?? '',
    ship_name: po.shipTo.name ?? '',
    ship_attn: po.shipTo.attention ?? '',
    ship_address1: po.shipTo.addrLine1 ?? '',
    ship_address2: po.shipTo.addrLine2 ?? '',
    ship_suite: po.shipTo.suiteUnit ?? '',
    ship_city: po.shipTo.city ?? '',
    ship_state: idOrEmpty(po.shipTo.stateId),
    ship_country: idOrEmpty(po.shipTo.countryId),
    ship_zip: po.shipTo.zip ?? '',
    ship_phone: po.shipTo.phone ?? '',
    ship_fax: po.shipTo.fax ?? '',
    ship_email: po.shipTo.email ?? '',
  };

  const lineItems: PurchaseOrderLineItem[] = po.items.map(fromLine);

  return {
    data,
    lineItems,
    vendor: { id: po.vendor.id, name: po.vendor.name },
    customFieldValues: po.customFields ?? {},
  };
}

/** Required-field check for the purchase_order workflow's custom field
 *  definitions (rendered via DynamicFieldInput) — mirrors the second loop of
 *  lib/crmValidation.ts's validateCrmRecord, standalone here since that
 *  helper is coupled to the CRM core-field registry. */
export function validatePurchaseOrderCustomFields(
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
