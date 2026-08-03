// Requisition form field definitions — mirrors lib/purchaseOrderForm.ts's
// shape, adapted to the Requisition backend contract (types/requisition.ts).
// Field keys are UI-facing (mapped to the create/update payload via
// toCreatePayload, not sent to the backend verbatim).
//
// Deliberately simpler than purchaseOrderForm: a requisition has no address
// block, no per-line discount or tax, and no shipping/adjustment — it is a
// rough internal ask, not a priced outward commitment.

import type { CrmLookups } from '@/services/lookupService';
import type { FieldDefinition } from '@/types/tenant';
import type {
  Requisition, RequisitionCreatePayload, RequisitionLineInput, RequisitionLine,
  RequisitionPriority,
} from '@/types/requisition';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface RequisitionFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'number' | 'date' | 'readonly';
  required?: boolean;
  options?: string[];
  /** When set, options are sourced from CrmLookups[lookupKey] (id/name pairs)
   *  instead of the static `options` string list — the field's value becomes
   *  the lookup row's numeric id (as a string), matching the create payload's
   *  *Id fields. */
  lookupKey?: keyof CrmLookups;
  placeholder?: string;
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

// ── Priority ─────────────────────────────────────────────────────────────────

/** The four values the backend accepts for `priority`. Ordered low → urgent
 *  so the select reads naturally; `normal` is the default. */
export const REQUISITION_PRIORITIES: { value: RequisitionPriority; label: string }[] = [
  { value: 'low', label: 'Low' },
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export const DEFAULT_PRIORITY: RequisitionPriority = 'normal';

/** Badge color per priority — shared by the list table and the detail header.
 *  `normal` is deliberately muted so only the exceptional values draw the eye. */
export const PRIORITY_COLORS: Record<string, string> = {
  low: '#94a3b8',
  normal: '#a8a29e',
  high: '#f97316',
  urgent: '#ef4444',
};

export function priorityLabel(value: string): string {
  return REQUISITION_PRIORITIES.find((p) => p.value === value)?.label ?? value;
}

// ── Form section field definitions ───────────────────────────────────────────

export const PRIMARY_INFO_FIELDS: RequisitionFormField[] = [
  {
    key: 'reqn_status',
    label: 'Requisition Status',
    type: 'readonly',
    placeholder: 'Draft',
  },
  {
    key: 'reqn_doc_num',
    label: 'Requisition #',
    type: 'readonly',
    placeholder: 'Auto-generated',
  },
  {
    key: 'requested_by',
    label: 'Requested By',
    type: 'select',
    lookupKey: 'employees',
    hint: 'Defaults to you when left blank.',
  },
  {
    key: 'department',
    label: 'Department',
    type: 'text',
    placeholder: 'e.g. Fabrication',
  },
  {
    key: 'needed_by_date',
    label: 'Needed By',
    type: 'date',
    hint: 'When the requested items are required.',
  },
  {
    key: 'priority',
    label: 'Priority',
    type: 'select',
    options: REQUISITION_PRIORITIES.map((p) => p.label),
  },
  {
    key: 'payment_terms',
    label: 'Payment Terms',
    type: 'select',
    lookupKey: 'paymentTerms',
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
    key: 'memo',
    label: 'Memo',
    type: 'textarea',
    placeholder: 'Why is this being requested…',
    colSpanFull: true,
  },
];

// ── Items grid ────────────────────────────────────────────────────────────────

/** One editable line row. A line is either a catalog pick
 *  (`inventoryItemUuid`; the server snapshots sku/name/unit/price) or free
 *  text — mirrors PurchaseOrderLineItem minus discount, per-line tax, and the
 *  post-tax `total` column (a requisition line has a single money value). */
export interface RequisitionLineItem {
  id: string;
  lineNo: number;
  itemName: string;
  itemDescription: string;
  quantity: string;
  estimatedUnitPrice: string;
  amount: string; // calculated: round2(qty * estimatedUnitPrice)
  /** Catalog reference — set when the line was picked from the inventory
   *  catalog (maps to the create payload's `inventoryItemUuid`). Absent for
   *  free-text lines. Display-only sku/units below come from the pick. */
  inventoryItemUuid?: string;
  itemSku?: string;
  units?: string;
}

export const EMPTY_LINE_ITEM: Omit<RequisitionLineItem, 'id' | 'lineNo'> = {
  itemName: '',
  itemDescription: '',
  quantity: '',
  estimatedUnitPrice: '',
  amount: '',
};

/** Clamps a percent field to [0, 100] as the user types, mirroring the
 *  backend's range check. Needed because the header's Sales Tax % commits on
 *  change rather than through a native form submit, so an `<input min max>`
 *  alone never blocks an out-of-range value. */
export function clampPercent(raw: string): string {
  if (raw === '') return raw;
  const n = parseFloat(raw);
  if (Number.isNaN(n)) return raw;
  const clamped = Math.min(100, Math.max(0, n));
  return clamped === n ? raw : String(clamped);
}

/** Rounds to 2 decimal places — mirrors the backend's `round2`
 *  (requisition/calc.go), so the client-side preview matches the server's
 *  stepwise math. */
export function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** Client-side preview of one line's estimated amount, replicating the
 *  backend's `ComputeLine` exactly: round2(quantity × estimatedUnitPrice).
 *  Server totals stay authoritative; this only drives the live preview. */
export function calcLineAmount(
  item: Pick<RequisitionLineItem, 'quantity' | 'estimatedUnitPrice'>,
): number {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.estimatedUnitPrice) || 0;
  return round2(qty * price);
}

/** Display-string variant of `calcLineAmount` for the items grid — blank (not
 *  "0.00") until both quantity and price are entered. */
export function calcLineItem(
  item: Pick<RequisitionLineItem, 'quantity' | 'estimatedUnitPrice'>,
): { amount: string } {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.estimatedUnitPrice) || 0;
  return { amount: qty && price ? calcLineAmount(item).toFixed(2) : '' };
}

/** Header totals aggregated from every line, mirroring the backend's
 *  `ComputeHeader` (requisition/calc.go) step for step.
 *
 *  The rounding *order* matters and is load-bearing: each line is rounded to
 *  2dp, the sum is rounded again, tax is computed from that rounded subtotal,
 *  and the total is rounded once more. Computing tax off an unrounded sum
 *  instead drifts a cent away from the value the server stores. */
export function calcHeaderTotals(
  lineItems: Pick<RequisitionLineItem, 'quantity' | 'estimatedUnitPrice'>[],
  headerTaxPercent: number,
): { subtotal: number; taxTotal: number; estimatedTotal: number } {
  let subtotal = 0;
  for (const item of lineItems) {
    subtotal += calcLineAmount(item);
  }
  subtotal = round2(subtotal);
  const taxTotal = round2((subtotal * (headerTaxPercent || 0)) / 100);
  const estimatedTotal = round2(subtotal + taxTotal);
  return { subtotal, taxTotal, estimatedTotal };
}

// ── Status catalog (backend requisition/transitions.go) ──────────────────────

/** Every `lkp_record_status` row seeded for the REQN record type. There is no
 *  RJCT status (same as PORD) — rework is a recall/revise back to DRFT. */
export const REQUISITION_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'PAPV', label: 'Pending Approval' },
  { code: 'APPV', label: 'Approved' },
  { code: 'CANC', label: 'Cancelled' },
];

/** Legal next-moves per status — mirrors the backend
 *  requisition/transitions.go `allowedTransitions` map. The terminal status
 *  (CANC) maps to an empty list. The backend (ValidateTransition) stays
 *  authoritative; an illegal pick is rejected with 409, so this only keeps
 *  the UI from offering one. */
export const REQUISITION_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRFT: ['PAPV', 'CANC'],
  PAPV: ['APPV', 'DRFT', 'CANC'],
  APPV: ['DRFT', 'CANC'],
  CANC: [],
};

/** Button label per (from, to) status-code pair — a plain `to`-keyed map
 *  can't distinguish "Recall to Draft" (PAPV→DRFT) from "Revise" (APPV→DRFT),
 *  so the key is `${from}:${to}`. */
export const REQUISITION_TRANSITION_LABELS: Record<string, string> = {
  'DRFT:PAPV': 'Submit for Approval',
  'DRFT:CANC': 'Cancel',
  'PAPV:APPV': 'Approve & Advance',
  'PAPV:DRFT': 'Recall to Draft',
  'PAPV:CANC': 'Cancel',
  'APPV:DRFT': 'Revise',
  'APPV:CANC': 'Cancel',
};

export function reqnTransitionLabel(from: string, to: string): string {
  return REQUISITION_TRANSITION_LABELS[`${from}:${to}`] ?? to;
}

/** Human label for a status code (e.g. "PAPV" -> "Pending Approval") — used
 *  by the transition confirmation dialog. Falls back to the raw code for an
 *  unrecognized one rather than throwing. */
export function reqnStatusLabel(code: string): string {
  return REQUISITION_STATUS_CODES.find((s) => s.code === code)?.label ?? code;
}

/** Approval gate (requisition/store_transition.go): once a status has
 *  configured approvers, every move away from it is blocked until
 *  `approvalStatus` reaches "approved" — except the recall back to DRFT,
 *  which is always allowed, since it is how a submitter withdraws a pending
 *  request for rework without an approver's sign-off. */
export function isReqnTransitionBlocked(toCode: string, approvalStatus: string): boolean {
  return toCode !== 'DRFT' && approvalStatus === 'pending';
}

/** Status badge color, shared by the list table, detail page, and transition
 *  bar. Keyed by status code (REQN statuses are fixed/seeded). */
export const REQUISITION_STATUS_COLORS: Record<string, string> = {
  DRFT: '#a8a29e',
  PAPV: '#f59e0b',
  APPV: '#22c55e',
  CANC: '#ef4444',
};

/** Statuses `requisitionService.updateRequisition` rejects edits against
 *  (requisition/store_update.go — editing is DRFT-only; recall to draft to
 *  revise, since a submitted requisition is awaiting someone's sign-off). */
export const REQN_NON_DRAFT_LOCKED = (statusCode: string): boolean => statusCode !== 'DRFT';

/** Statuses from which Delete is offered (requisition/store.go — delete is
 *  DRFT/CANC only). */
export const REQN_DELETABLE_STATUSES = new Set(['DRFT', 'CANC']);

/** Only an approved requisition may convert to a purchase order
 *  (purchaseorder/store_convert.go), and only once — an already-converted
 *  requisition carries `convertedPurchaseOrderId` and links to it instead. */
export function canConvertToPurchaseOrder(
  statusCode: string,
  convertedPurchaseOrderId?: string,
): boolean {
  return statusCode === 'APPV' && !convertedPurchaseOrderId;
}

// ── Form defaults ─────────────────────────────────────────────────────────────

export function requisitionDefaults(): Record<string, unknown> {
  return {
    reqn_status: 'Draft',
    priority: priorityLabel(DEFAULT_PRIORITY),
    sales_tax_pct: '0',
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

/** Maps the priority <select>'s display label back to the wire value the
 *  backend accepts. Falls back to the default rather than sending an
 *  unrecognized string the server would reject. */
export function toPriorityValue(label: unknown): RequisitionPriority {
  const s = toStr(label).trim();
  const byLabel = REQUISITION_PRIORITIES.find((p) => p.label === s);
  if (byLabel) return byLabel.value;
  const byValue = REQUISITION_PRIORITIES.find((p) => p.value === s.toLowerCase());
  return byValue ? byValue.value : DEFAULT_PRIORITY;
}

/** Maps one editable line row to the create/update contract's line shape. An
 *  explicit `itemDescription` always wins (overrides a catalog item's own
 *  description, or supplies detail for a free-text line); otherwise a catalog
 *  line (`inventoryItemUuid` set) sends no description — the server snapshots
 *  the catalog item's own — while a free-text line falls back to `itemName`,
 *  since the backend requires a description there. */
function toLineInput(item: RequisitionLineItem, lineNo: number): RequisitionLineInput {
  return {
    lineNumber: lineNo,
    inventoryItemUuid: item.inventoryItemUuid || undefined,
    description: (item.itemDescription || '').trim()
      || (item.inventoryItemUuid ? undefined : (item.itemName || undefined)),
    quantity: toNum(item.quantity),
    estimatedUnitPrice: toNum(item.estimatedUnitPrice),
  };
}

/** Maps the Add/Edit page form state + line items to the backend's
 *  `RequisitionCreatePayload`. `vendorUuid` comes from the VendorPicker's
 *  selection (stored under `vendor_uuid` in form state) and is only ever a
 *  suggestion. Status is intentionally omitted: every new requisition starts
 *  at DRFT server-side; status changes go through the `/transition` endpoint. */
export function toCreatePayload(
  data: Record<string, unknown>,
  lineItems: RequisitionLineItem[],
  customFields: Record<string, unknown> = {},
): RequisitionCreatePayload {
  return {
    requestedByEmployeeId: toIntOrNull(data.requested_by),
    department: toStr(data.department),
    neededByDate: toStr(data.needed_by_date) || undefined,
    priority: toPriorityValue(data.priority),
    memo: toStr(data.memo),
    vendorUuid: toStr(data.vendor_uuid) || undefined,
    paymentTermsId: toIntOrNull(data.payment_terms),
    salesTaxPercent: toNum(data.sales_tax_pct),
    customFields,
    items: lineItems.map((item, i) => toLineInput(item, i + 1)),
  };
}

/** id-or-empty for a lookupKey <select>'s bound value: null/undefined must
 *  render as "— Select —" (empty string), never "0" or "null". */
function idOrEmpty(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

function fromLine(line: RequisitionLine, i: number): RequisitionLineItem {
  return {
    id: `existing-${i}`,
    lineNo: line.lineNumber,
    // Free-text lines saved before the backend snapshotted item_name from the
    // description round-trip with an empty itemName — fall back to
    // description so the Edit page doesn't reject the line as having neither
    // a catalog item nor a name.
    itemName: line.itemName || line.description,
    itemDescription: line.description ?? '',
    itemSku: line.sku,
    units: line.unitCode,
    quantity: String(line.quantity),
    estimatedUnitPrice: String(line.estimatedUnitPrice),
    amount: line.estimatedAmount.toFixed(2),
    inventoryItemUuid: line.inventoryItemId ?? undefined,
  };
}

/** Maps a loaded Requisition (GET response) back to the Edit form's state —
 *  the inverse of toCreatePayload. Vendor is returned separately since it's
 *  driven by VendorPicker's own state, not a plain form field, and is null
 *  when no vendor was suggested. */
export function fromRequisition(reqn: Requisition): {
  data: Record<string, unknown>;
  lineItems: RequisitionLineItem[];
  vendor: { id: string; name: string } | null;
  customFieldValues: Record<string, unknown>;
} {
  const data: Record<string, unknown> = {
    reqn_status: reqn.status,
    reqn_doc_num: reqn.requisitionNumber,
    requested_by: reqn.requestedByEmployeeId ? String(reqn.requestedByEmployeeId) : '',
    department: reqn.department ?? '',
    needed_by_date: reqn.neededByDate ?? '',
    priority: priorityLabel(reqn.priority ?? DEFAULT_PRIORITY),
    payment_terms: idOrEmpty(reqn.paymentTermsId),
    sales_tax_pct: String(reqn.salesTaxPercent ?? 0),
    memo: reqn.memo ?? '',
  };

  const lineItems: RequisitionLineItem[] = reqn.items.map(fromLine);

  return {
    data,
    lineItems,
    vendor: reqn.vendor ? { id: reqn.vendor.id, name: reqn.vendor.name } : null,
    customFieldValues: reqn.customFields ?? {},
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

/** A line is valid when it carries either a catalog item or a non-empty name
 *  or description — mirrors the backend's rule that a free-text line requires
 *  a description. Returns the 1-based positions of the invalid rows so the
 *  caller can name them in an error message. */
export function invalidLinePositions(lineItems: RequisitionLineItem[]): number[] {
  const bad: number[] = [];
  lineItems.forEach((item, i) => {
    const hasIdentity = Boolean(item.inventoryItemUuid)
      || item.itemName.trim() !== ''
      || item.itemDescription.trim() !== '';
    if (!hasIdentity) bad.push(i + 1);
  });
  return bad;
}

/** Required-field check for the requisition workflow's custom field
 *  definitions (rendered via DynamicFieldInput) — mirrors
 *  validatePurchaseOrderCustomFields. */
export function validateRequisitionCustomFields(
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
