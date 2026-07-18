// Estimate form field definitions — mirrors lib/invoiceForm.ts's shape,
// adapted to the Estimate backend contract (types/estimate.ts). Field keys
// are UI-facing (mapped to the create/update payload via toCreatePayload, not
// sent to the backend verbatim).

import type { CrmLookups } from '@/services/lookupService';
import type { Estimate, EstimateCreatePayload, EstimateLineInput } from '@/types/estimate';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface EstimateFormField {
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
  /** Only render when the referenced field is false/unchecked */
  showIfFieldFalse?: string;
  /** Textarea row count (only used when type === 'textarea') */
  rows?: number;
  /** Small helper line rendered under the field */
  hint?: string;
  /** Native min/max for type: 'number' fields */
  min?: number;
  max?: number;
}

// ── Form section field definitions ───────────────────────────────────────────

export const PRIMARY_INFO_FIELDS: EstimateFormField[] = [
  {
    key: 'estimate_status',
    label: 'Estimate Status',
    type: 'readonly',
    placeholder: 'Draft',
  },
  {
    key: 'estimate_doc_num',
    label: 'Estimate #',
    type: 'readonly',
    placeholder: 'Auto-generated',
  },
  {
    key: 'purchase_doc_num',
    label: 'Purchase Order #',
    type: 'text',
    placeholder: 'Enter PO number',
  },
  {
    key: 'reference_number',
    label: 'Reference #',
    type: 'text',
    placeholder: 'Enter a reference number',
  },
  {
    key: 'estimate_date',
    label: 'Estimate Date',
    type: 'date',
    required: true,
  },
  {
    key: 'valid_until',
    label: 'Valid Until',
    type: 'date',
    hint: 'Leave blank if this estimate has no expiration date.',
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
    key: 'currency_id',
    label: 'Currency',
    type: 'select',
    lookupKey: 'currencies',
  },
  {
    key: 'memo',
    label: 'Memo',
    type: 'textarea',
    placeholder: 'Notes related to this estimate…',
    colSpanFull: true,
  },
];

// bill_customer/bill_customer_uuid are handled by a dedicated customer picker
// (CustomerPicker) in AddEstimatePage, not the generic EstimateSectionGrid —
// a customer is a searchable record, not a static lookup list.
export const BILL_TO_FIELDS: EstimateFormField[] = [
  {
    key: 'bill_attn',
    label: 'Attn:',
    type: 'text',
    placeholder: 'Authorized contact person',
  },
  {
    key: 'bill_address1',
    label: 'Address Line 1',
    type: 'textarea',
    rows: 2,
    colSpan2: true,
    placeholder: '123 Main Street',
  },
  {
    key: 'bill_address2',
    label: 'Address Line 2',
    type: 'textarea',
    rows: 2,
    colSpan2: true,
    placeholder: 'Apt, suite, floor, etc.',
  },
  {
    key: 'bill_suite',
    label: 'Suite / Unit #',
    type: 'text',
    placeholder: 'Suite 100',
  },
  { key: 'bill_city', label: 'City', type: 'text', placeholder: 'City' },
  { key: 'bill_country', label: 'Country', type: 'select', lookupKey: 'countries' },
  { key: 'bill_state', label: 'State', type: 'select', lookupKey: 'states', dependsOn: 'bill_country' },
  {
    key: 'bill_zip',
    label: 'Zip / Postal Code',
    type: 'text',
    placeholder: '12345',
  },
  {
    key: 'bill_phone',
    label: 'Phone',
    type: 'tel',
    placeholder: '+1 (555) 000-0000',
  },
  {
    key: 'bill_fax',
    label: 'Fax',
    type: 'tel',
    placeholder: '+1 (555) 000-0000',
  },
  {
    key: 'bill_email',
    label: 'Email',
    type: 'email',
    placeholder: 'billing@company.com',
  },
  {
    key: 'payment_terms',
    label: 'Payment Terms',
    type: 'select',
    lookupKey: 'paymentTerms',
  },
  {
    key: 'price_level',
    label: 'Price Level',
    type: 'select',
    lookupKey: 'priceLevels',
  },
];

export const SHIP_TO_FIELDS: EstimateFormField[] = [
  {
    key: 'ship_same_as_bill',
    label: 'Is Same as Billing Customer',
    type: 'checkbox',
    colSpanFull: true,
  },
  {
    key: 'ship_customer',
    label: 'Shipping Customer',
    type: 'text',
    showIfFieldFalse: 'ship_same_as_bill',
    placeholder: 'Shipping customer name',
  },
  {
    key: 'ship_attn',
    label: 'Attn:',
    type: 'text',
    showIfFieldFalse: 'ship_same_as_bill',
    placeholder: 'Authorized contact person',
  },
  {
    key: 'ship_address1',
    label: 'Address Line 1',
    type: 'textarea',
    rows: 2,
    showIfFieldFalse: 'ship_same_as_bill',
    colSpan2: true,
    placeholder: '123 Main Street',
  },
  {
    key: 'ship_address2',
    label: 'Address Line 2',
    type: 'textarea',
    rows: 2,
    showIfFieldFalse: 'ship_same_as_bill',
    colSpan2: true,
    placeholder: 'Apt, suite, floor, etc.',
  },
  {
    key: 'ship_suite',
    label: 'Suite / Unit #',
    type: 'text',
    showIfFieldFalse: 'ship_same_as_bill',
    placeholder: 'Suite 100',
  },
  {
    key: 'ship_city',
    label: 'City',
    type: 'text',
    showIfFieldFalse: 'ship_same_as_bill',
    placeholder: 'City',
  },
  {
    key: 'ship_country',
    label: 'Country',
    type: 'select',
    showIfFieldFalse: 'ship_same_as_bill',
    lookupKey: 'countries',
  },
  {
    key: 'ship_state',
    label: 'State',
    type: 'select',
    showIfFieldFalse: 'ship_same_as_bill',
    lookupKey: 'states',
    dependsOn: 'ship_country',
  },
  {
    key: 'ship_zip',
    label: 'Zip / Postal Code',
    type: 'text',
    showIfFieldFalse: 'ship_same_as_bill',
    placeholder: '12345',
  },
  {
    key: 'ship_phone',
    label: 'Phone',
    type: 'tel',
    showIfFieldFalse: 'ship_same_as_bill',
    placeholder: '+1 (555) 000-0000',
  },
  {
    key: 'ship_fax',
    label: 'Fax',
    type: 'tel',
    showIfFieldFalse: 'ship_same_as_bill',
    placeholder: '+1 (555) 000-0000',
  },
  {
    key: 'ship_email',
    label: 'Email',
    type: 'email',
    showIfFieldFalse: 'ship_same_as_bill',
    placeholder: 'shipping@company.com',
  },
];

// sales_rep/customer_owner are employee references — sourced from the
// `employees` lookup rather than free text, matching salesRepEmployeeId /
// ownerEmployeeId (employee FKs) on the create payload.
export const SALES_INFO_FIELDS: EstimateFormField[] = [
  {
    key: 'sales_rep',
    label: 'Sales Rep',
    type: 'select',
    lookupKey: 'employees',
  },
  {
    key: 'customer_owner',
    label: 'Customer Owner',
    type: 'select',
    lookupKey: 'employees',
  },
];

// ── Items sub-tab ─────────────────────────────────────────────────────────────

// Unlike Sales Order, the Estimate backend has no per-line free-text sku/
// itemName/unitCode/taxPercent override — a line is either a catalog pick
// (inventoryItemUuid; server snapshots sku/name/unit) or free text, where
// `itemName` doubles as the `description` sent to the server. Per-line tax
// always follows the header's Sales Tax % (there's no tax-rate picker UI
// yet), so `total` is computed from the header rate, not a per-line one.
export interface EstimateLineItem {
  id: string;
  lineNo: number;
  itemName: string;
  quantity: string;
  unitPrice: string;
  discount: string;
  amount: string;   // calculated
  total: string;    // calculated, using the header's Sales Tax %
  /** Catalog reference — set when the line was picked from the inventory
   *  catalog (maps to the create payload's `inventoryItemUuid`). Absent for
   *  free-text lines. Display-only sku/units below come from the pick. */
  inventoryItemUuid?: string;
  itemSku?: string;
  units?: string;
}

export const EMPTY_LINE_ITEM: Omit<EstimateLineItem, 'id' | 'lineNo'> = {
  itemName: '',
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

/** Client-side estimate of a line's amount/total, using the header's Sales
 *  Tax % (the backend defaults every line to that rate unless a taxRateId is
 *  set, which this form doesn't yet expose — see EstimateLineItem doc). */
export function calcLineItem(
  item: Pick<EstimateLineItem, 'quantity' | 'unitPrice' | 'discount'>,
  headerTaxPercent: number,
): { amount: string; total: string } {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unitPrice) || 0;
  const disc = parseFloat(item.discount) || 0;
  const amount = qty * price * (1 - disc / 100);
  const total = amount * (1 + (headerTaxPercent || 0) / 100);
  return {
    amount: qty && price ? amount.toFixed(2) : '',
    total: qty && price ? total.toFixed(2) : '',
  };
}

// ── Status catalog (backend spec §7 — fixed, forward-only state machine) ─────

/** Every `lkp_record_status` row seeded for the ESTM record type. The backend
 *  (`estimate.ValidateTransition`) is the source of truth for which moves are
 *  actually legal from a given status — this list only drives the Edit page's
 *  "change status" select; an illegal pick is rejected server-side with a
 *  409, surfaced as a normal save error. There is no "Accepted" status:
 *  acceptance is expressed by converting the estimate into a quote, which
 *  does not require a status change here. */
export const ESTIMATE_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'PAPV', label: 'Pending Approval' },
  { code: 'APPV', label: 'Approved' },
  { code: 'SENT', label: 'Sent' },
  { code: 'RJCT', label: 'Rejected' },
  { code: 'EXPR', label: 'Expired' },
  { code: 'CANC', label: 'Cancelled' },
];

/** Legal next-moves per status — mirrors the backend estimate/transitions.go
 *  `allowedTransitions` (spec §7). Terminal statuses (RJCT, EXPR, CANC) map to
 *  an empty list. The backend (ValidateTransition) stays authoritative; an
 *  illegal pick is rejected with 409, so this only keeps the UI from offering
 *  one. */
export const ESTIMATE_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRFT: ['PAPV', 'CANC'],
  PAPV: ['APPV', 'DRFT', 'CANC'],
  APPV: ['SENT', 'CANC'],
  SENT: ['RJCT', 'EXPR', 'CANC'],
  RJCT: [],
  EXPR: [],
  CANC: [],
};

/** Status badge color, keyed by the human label (matches
 *  ESTIMATE_STATUS_CODES' labels) — shared by the list table, detail page,
 *  and status control. */
export const ESTIMATE_STATUS_COLORS: Record<string, string> = {
  Draft: '#a8a29e',
  'Pending Approval': '#f59e0b',
  Approved: '#3b82f6',
  Sent: '#6366f1',
  Rejected: '#ef4444',
  Expired: '#78716c',
  Cancelled: '#78716c',
};

/** Statuses `estimateService.updateEstimate` rejects edits against
 *  (estimate/store_update.go — "A rejected, expired, or cancelled estimate
 *  cannot be edited."). */
export const ESTIMATE_TERMINAL_STATUSES = new Set(['RJCT', 'EXPR', 'CANC']);

// ── Form defaults ─────────────────────────────────────────────────────────────

export function estimateDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    estimate_date: today,
    estimate_status: 'Draft',
    ship_same_as_bill: false,
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

/** Maps one editable line row to the create/update contract's line shape. A
 *  row with `inventoryItemUuid` set is a catalog line (server snapshots its
 *  sku/name/unit/price, ignoring `itemName` below unless the catalog item has
 *  no description); otherwise it's free-text and `itemName` is sent as the
 *  line's `description` (see EstimateLineItem doc). */
function toLineInput(item: EstimateLineItem, lineNo: number): EstimateLineInput {
  return {
    lineNumber: lineNo,
    inventoryItemUuid: item.inventoryItemUuid || undefined,
    description: item.inventoryItemUuid ? undefined : (item.itemName || undefined),
    quantity: toNum(item.quantity),
    unitPrice: toNum(item.unitPrice),
    discountPercent: toNum(item.discount),
  };
}

/** Maps the AddEstimatePage form state + line items to the backend's
 *  `EstimateCreatePayload`. `customerUuid` comes from the CustomerPicker's
 *  selection (stored under `customer_uuid` in form state) — the free-text
 *  billing display name is never sent, only the id. Status is intentionally
 *  omitted: every new estimate starts at DRFT server-side; status changes go
 *  through the `/transition` endpoint. */
export function toCreatePayload(
  data: Record<string, unknown>,
  lineItems: EstimateLineItem[],
): EstimateCreatePayload {
  const shipSameAsBilling = Boolean(data.ship_same_as_bill);

  return {
    customerUuid: toStr(data.customer_uuid),
    poNumber: toStr(data.purchase_doc_num),
    referenceNumber: toStr(data.reference_number),
    estimateDate: toStr(data.estimate_date),
    validUntil: toStr(data.valid_until) || undefined,
    paymentTermsId: toIntOrNull(data.payment_terms),
    priceLevelId: toIntOrNull(data.price_level),
    currencyId: toIntOrNull(data.currency_id),
    salesRepEmployeeId: toIntOrNull(data.sales_rep),
    ownerEmployeeId: toIntOrNull(data.customer_owner),
    salesTaxPercent: toNum(data.sales_tax_pct),
    memo: toStr(data.memo),
    shipSameAsBilling,
    billing: {
      attention: toStr(data.bill_attn),
      addrLine1: toStr(data.bill_address1),
      addrLine2: toStr(data.bill_address2),
      suiteUnit: toStr(data.bill_suite),
      city: toStr(data.bill_city),
      stateId: toIntOrNull(data.bill_state),
      countryId: toIntOrNull(data.bill_country),
      zip: toStr(data.bill_zip),
      phone: toStr(data.bill_phone),
      fax: toStr(data.bill_fax),
      email: toStr(data.bill_email),
    },
    shipping: shipSameAsBilling ? undefined : {
      customerName: toStr(data.ship_customer),
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
    customFields: {},
    items: lineItems.map((item, i) => toLineInput(item, i + 1)),
  };
}

/** id-or-empty for a lookupKey <select>'s bound value: null/undefined must
 *  render as "— Select —" (empty string), never "0" or "null". */
function idOrEmpty(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

/** Maps a loaded Estimate (GET response) back to the Edit form's state — the
 *  inverse of toCreatePayload. Customer is returned separately since it's
 *  driven by CustomerPicker's own state, not a plain form field. */
export function fromEstimate(estimate: Estimate): {
  data: Record<string, unknown>;
  lineItems: EstimateLineItem[];
  customer: { id: string; name: string };
} {
  const data: Record<string, unknown> = {
    estimate_status: estimate.status,
    estimate_doc_num: estimate.estimateNumber,
    purchase_doc_num: estimate.poNumber ?? '',
    reference_number: estimate.referenceNumber ?? '',
    estimate_date: estimate.estimateDate,
    valid_until: estimate.validUntil ?? '',
    sales_tax_pct: String(estimate.salesTaxPercent ?? 0),
    currency_id: idOrEmpty(estimate.currencyId),
    memo: estimate.memo ?? '',
    bill_attn: estimate.billing.attention ?? '',
    bill_address1: estimate.billing.addrLine1 ?? '',
    bill_address2: estimate.billing.addrLine2 ?? '',
    bill_suite: estimate.billing.suiteUnit ?? '',
    bill_city: estimate.billing.city ?? '',
    bill_state: idOrEmpty(estimate.billing.stateId),
    bill_country: idOrEmpty(estimate.billing.countryId),
    bill_zip: estimate.billing.zip ?? '',
    bill_phone: estimate.billing.phone ?? '',
    bill_fax: estimate.billing.fax ?? '',
    bill_email: estimate.billing.email ?? '',
    payment_terms: idOrEmpty(estimate.paymentTermsId),
    price_level: idOrEmpty(estimate.priceLevelId),
    ship_same_as_bill: estimate.shipSameAsBilling,
    ship_customer: estimate.shipping.customerName ?? '',
    ship_attn: estimate.shipping.attention ?? '',
    ship_address1: estimate.shipping.addrLine1 ?? '',
    ship_address2: estimate.shipping.addrLine2 ?? '',
    ship_suite: estimate.shipping.suiteUnit ?? '',
    ship_city: estimate.shipping.city ?? '',
    ship_state: idOrEmpty(estimate.shipping.stateId),
    ship_country: idOrEmpty(estimate.shipping.countryId),
    ship_zip: estimate.shipping.zip ?? '',
    ship_phone: estimate.shipping.phone ?? '',
    ship_fax: estimate.shipping.fax ?? '',
    ship_email: estimate.shipping.email ?? '',
    sales_rep: idOrEmpty(estimate.salesRepEmployeeId),
    customer_owner: idOrEmpty(estimate.ownerEmployeeId),
  };

  const lineItems: EstimateLineItem[] = estimate.items.map((line, i) => ({
    id: `existing-${i}`,
    lineNo: line.lineNumber,
    // Free-text lines saved before the backend snapshotted item_name from
    // the description (estimate/store_create.go resolveLines) round-trip
    // with an empty itemName — fall back to description so the Edit page
    // doesn't reject the line as having neither a catalog item nor a name.
    itemName: line.itemName || line.description,
    itemSku: line.sku,
    units: line.unitCode,
    quantity: String(line.quantity),
    unitPrice: String(line.unitPrice),
    discount: String(line.discountPercent),
    amount: line.lineSubtotal.toFixed(2),
    total: line.lineTotal.toFixed(2),
    inventoryItemUuid: line.inventoryItemId ?? undefined,
  }));

  return { data, lineItems, customer: { id: estimate.customer.id, name: estimate.customer.name } };
}
