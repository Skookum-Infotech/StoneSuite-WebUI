// Quote form field definitions — mirrors lib/estimateForm.ts's shape,
// adapted to the Quote backend contract (types/quote.ts). Field keys are
// UI-facing (mapped to the create/update payload via toCreatePayload, not
// sent to the backend verbatim).

import type { CrmLookups } from '@/services/lookupService';
import type { Quote, QuoteCreatePayload, QuoteLineInput } from '@/types/quote';
import type { Estimate } from '@/types/estimate';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface QuoteFormField {
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

export const PRIMARY_INFO_FIELDS: QuoteFormField[] = [
  {
    key: 'quote_status',
    label: 'Quote Status',
    type: 'readonly',
    placeholder: 'Draft',
  },
  {
    key: 'quote_doc_num',
    label: 'Quote #',
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
    key: 'quote_date',
    label: 'Quote Date',
    type: 'date',
    required: true,
  },
  {
    key: 'valid_until',
    label: 'Valid Until',
    type: 'date',
    hint: 'Leave blank if this quote has no expiration date.',
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
    placeholder: 'Notes related to this quote…',
    colSpanFull: true,
  },
];

// bill_customer/bill_customer_uuid are handled by a dedicated customer picker
// (CustomerPicker) in AddQuotePage, not the generic QuoteSectionGrid — a
// customer is a searchable record, not a static lookup list.
//
// Same shape as Estimate/SalesOrder's Bill To: state/country are numeric
// lookupKey selects (QuoteAddressInput: stateId/countryId), not free text.
export const BILL_TO_FIELDS: QuoteFormField[] = [
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

export const SHIP_TO_FIELDS: QuoteFormField[] = [
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
];

// sales_rep/customer_owner are employee references — sourced from the
// `employees` lookup rather than free text, matching salesRepEmployeeId /
// ownerEmployeeId (employee FKs) on the create payload.
export const SALES_INFO_FIELDS: QuoteFormField[] = [
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

// A Quote line is either a catalog pick (inventoryItemUuid; server snapshots
// sku/name/unit) or free text — same rule as Estimate (see estimateForm.ts's
// EstimateLineItem doc). The backend's `description` field is independent of
// `itemName`: an explicit `itemDescription` is always sent when set (letting
// a catalog pick's description be overridden, or a free-text line carry
// detail beyond its name); if left blank on a free-text line, `itemName` is
// sent as the description instead, since the backend requires one there (see
// toLineInput). Per-line tax always follows the header's Sales Tax % (no
// tax-rate picker UI yet), so `total` is computed from the header rate, not
// a per-line one.
export interface QuoteLineItem {
  id: string;
  lineNo: number;
  itemName: string;
  itemDescription: string;
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

export const EMPTY_LINE_ITEM: Omit<QuoteLineItem, 'id' | 'lineNo'> = {
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

/** Client-side estimate of a line's amount/total, using the header's Sales
 *  Tax % (the backend defaults every line to that rate unless a taxRateId is
 *  set, which this form doesn't yet expose — see QuoteLineItem doc). */
export function calcLineItem(
  item: Pick<QuoteLineItem, 'quantity' | 'unitPrice' | 'discount'>,
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

// ── Status catalog (matches the given workflow — fixed, forward-only state machine) ─

/** Every `lkp_record_status` row seeded for the QUOT record type. The backend
 *  is the source of truth for which moves are actually legal from a given
 *  status — this list only drives the Edit page's "change status" select; an
 *  illegal pick is rejected server-side with a 409, surfaced as a normal
 *  save error. */
export const QUOTE_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'PAPV', label: 'Pending Approval' },
  { code: 'APPV', label: 'Approved' },
  { code: 'SENT', label: 'Sent' },
  { code: 'RJCT', label: 'Rejected' },
  { code: 'EXPR', label: 'Expired' },
  { code: 'CANC', label: 'Cancelled' },
];

/** Legal next-moves per status — mirrors the backend quote/transitions.go
 *  `allowedTransitions` (spec §7). Terminal statuses (RJCT, EXPR, CANC) map to
 *  an empty list. The backend (ValidateTransition) stays authoritative; an
 *  illegal pick is rejected with 409, so this only keeps the UI from offering
 *  one. */
export const QUOTE_ALLOWED_TRANSITIONS: Record<string, string[]> = {
  DRFT: ['PAPV', 'CANC'],
  PAPV: ['APPV', 'DRFT', 'CANC'],
  APPV: ['SENT', 'CANC'],
  SENT: ['RJCT', 'EXPR', 'CANC'],
  RJCT: [],
  EXPR: [],
  CANC: [],
};

/** Status badge color, keyed by the human label (matches
 *  QUOTE_STATUS_CODES' labels) — shared by the list table, detail page,
 *  and status control. */
export const QUOTE_STATUS_COLORS: Record<string, string> = {
  Draft: '#a8a29e',
  'Pending Approval': '#f59e0b',
  Approved: '#3b82f6',
  Sent: '#6366f1',
  Rejected: '#ef4444',
  Expired: '#78716c',
  Cancelled: '#78716c',
};

/** Statuses `quoteService.updateQuote` rejects edits against — a rejected,
 *  expired, or cancelled quote cannot be edited. */
export const QUOTE_TERMINAL_STATUSES = new Set(['RJCT', 'EXPR', 'CANC']);

/** Whether the quote's current status is awaiting sign-off (AD-8) — while
 *  true, every transition 409s (quote/store_transition.go: ErrApprovalRequired)
 *  until a configured approver (or a super admin override) calls
 *  quoteService.approve, regardless of who's asking or which target they
 *  pick. Prefers the live `gated` flag from GET (recomputed server-side from
 *  the *current* approver config every read, so it correctly flips false the
 *  moment an admin empties the approver list out from under a quote already
 *  sitting in "pending" — at that point Transition no longer blocks either,
 *  so anyone with quote:transition can move it forward directly). List rows
 *  don't carry `gated` (too expensive to compute per search result) so they
 *  fall back to the stored approvalStatus flag, which is a fine
 *  approximation for a table cell. */
export function needsApproval(quote: Pick<Quote, 'approvalStatus'> & { gated?: boolean }): boolean {
  return quote.gated ?? quote.approvalStatus === 'pending';
}

/** Client-side precondition check for the "Send to Customer" quick action
 *  (Quote detail page). Mirrors the backend's own requirement — the generic
 *  document/send endpoint 400s "At least one recipient is required" when
 *  billing.email is blank and no `to` override is supplied — plus two
 *  UX-only checks (customer, line items) so the user gets one inline list of
 *  problems instead of a raw 400 after opening the confirm dialog. Not
 *  status-gated: available regardless of quote.statusCode. */
export function validateForSend(
  quote: Pick<Quote, 'customer' | 'items' | 'billing'>,
): string[] {
  const errors: string[] = [];
  if (!quote.customer?.id) errors.push('A customer is required.');
  if (!quote.items || quote.items.length === 0) errors.push('At least one line item is required.');
  if (!quote.billing?.email?.trim()) errors.push('A billing email is required to send this quote.');
  return errors;
}

/** Statuses from which "Convert to Sales Order" is offered — a quote has to
 *  have cleared internal approval and/or reached the customer before it can
 *  become a sales order. Hidden on Draft/Pending Approval (not ready) and the
 *  terminal statuses (dead ends). */
export const QUOTE_CONVERTIBLE_STATUSES = new Set(['APPV', 'SENT']);

// ── Form defaults ─────────────────────────────────────────────────────────────

export function quoteDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    quote_date: today,
    quote_status: 'Draft',
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

/** Maps one editable line row to the create/update contract's line shape. An
 *  explicit `itemDescription` always wins (overrides a catalog item's own
 *  description, or supplies detail for a free-text line); otherwise a
 *  catalog line (`inventoryItemUuid` set) sends no description — the server
 *  snapshots the catalog item's own — while a free-text line falls back to
 *  `itemName`, since the backend requires a description there (see
 *  QuoteLineItem doc). */
function toLineInput(item: QuoteLineItem, lineNo: number): QuoteLineInput {
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

/** Maps the Add/Edit Quote form state + line items to the backend's
 *  `QuoteCreatePayload`. `customerUuid` comes from the CustomerPicker's
 *  selection (stored under `customer_uuid` in form state) — the free-text
 *  billing display name is never sent, only the id. Status is intentionally
 *  omitted: every new quote starts at DRFT server-side; status changes go
 *  through the `/transition` endpoint. `estimateUuid` is passed separately
 *  (not stored in `data`) since it only applies on create, from a source
 *  estimate the create form was navigated from — see plan Decision #6. */
export function toCreatePayload(
  data: Record<string, unknown>,
  lineItems: QuoteLineItem[],
  estimateUuid?: string,
): QuoteCreatePayload {
  const shipSameAsBilling = Boolean(data.ship_same_as_bill);

  return {
    customerUuid: toStr(data.customer_uuid),
    estimateUuid: estimateUuid || undefined,
    poNumber: toStr(data.purchase_doc_num),
    referenceNumber: toStr(data.reference_number),
    quoteDate: toStr(data.quote_date),
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

/** Maps a loaded Quote (GET response) back to the Edit form's state — the
 *  inverse of toCreatePayload. Customer is returned separately since it's
 *  driven by CustomerPicker's own state, not a plain form field. */
export function fromQuote(quote: Quote): {
  data: Record<string, unknown>;
  lineItems: QuoteLineItem[];
  customer: { id: string; name: string };
} {
  const data: Record<string, unknown> = {
    quote_status: quote.status,
    quote_doc_num: quote.quoteNumber,
    purchase_doc_num: quote.poNumber ?? '',
    reference_number: quote.referenceNumber ?? '',
    quote_date: quote.quoteDate,
    valid_until: quote.validUntil ?? '',
    sales_tax_pct: String(quote.salesTaxPercent ?? 0),
    currency_id: idOrEmpty(quote.currencyId),
    memo: quote.memo ?? '',
    bill_attn: quote.billing.attention ?? '',
    bill_address1: quote.billing.addrLine1 ?? '',
    bill_address2: quote.billing.addrLine2 ?? '',
    bill_suite: quote.billing.suiteUnit ?? '',
    bill_city: quote.billing.city ?? '',
    bill_state: idOrEmpty(quote.billing.stateId),
    bill_country: idOrEmpty(quote.billing.countryId),
    bill_zip: quote.billing.zip ?? '',
    bill_phone: quote.billing.phone ?? '',
    bill_fax: quote.billing.fax ?? '',
    payment_terms: idOrEmpty(quote.paymentTermsId),
    price_level: idOrEmpty(quote.priceLevelId),
    ship_same_as_bill: quote.shipSameAsBilling,
    ship_customer: quote.shipping.customerName ?? '',
    ship_attn: quote.shipping.attention ?? '',
    ship_address1: quote.shipping.addrLine1 ?? '',
    ship_address2: quote.shipping.addrLine2 ?? '',
    ship_suite: quote.shipping.suiteUnit ?? '',
    ship_city: quote.shipping.city ?? '',
    ship_state: idOrEmpty(quote.shipping.stateId),
    ship_country: idOrEmpty(quote.shipping.countryId),
    ship_zip: quote.shipping.zip ?? '',
    ship_phone: quote.shipping.phone ?? '',
    ship_fax: quote.shipping.fax ?? '',
    sales_rep: idOrEmpty(quote.salesRepEmployeeId),
    customer_owner: idOrEmpty(quote.ownerEmployeeId),
  };

  const lineItems: QuoteLineItem[] = quote.items.map((line, i) => ({
    id: `existing-${i}`,
    lineNo: line.lineNumber,
    itemName: line.itemName || line.description,
    itemDescription: line.description ?? '',
    itemSku: line.sku,
    units: line.unitCode,
    quantity: String(line.quantity),
    unitPrice: String(line.unitPrice),
    discount: String(line.discountPercent),
    amount: line.lineSubtotal.toFixed(2),
    total: line.lineTotal.toFixed(2),
    inventoryItemUuid: line.inventoryItemId ?? undefined,
  }));

  return { data, lineItems, customer: { id: quote.customer.id, name: quote.customer.name } };
}

/** Prefills the Add Quote form from a source estimate (`?fromEstimate=<uuid>`
 *  — see plan Decision #6). Only header fields with a direct, unambiguous
 *  mapping are carried over (PO number, sales tax %, memo); billing/shipping
 *  is intentionally left blank — a quote's address block should reflect the
 *  customer as of quote creation, not stale data copied from the source
 *  estimate. Every estimate line carries over, catalog-referenced or
 *  free-text — a Quote line supports both, same as Estimate (see
 *  QuoteLineItem doc). */
export function fromSourceEstimate(estimate: Estimate): {
  data: Record<string, unknown>;
  lineItems: QuoteLineItem[];
  customer: { id: string; name: string };
} {
  const data: Record<string, unknown> = {
    purchase_doc_num: estimate.poNumber ?? '',
    sales_tax_pct: String(estimate.salesTaxPercent ?? 0),
    memo: estimate.memo ?? '',
  };

  const lineItems: QuoteLineItem[] = estimate.items
    .map((line, i) => ({
      id: `from-estimate-${i}`,
      lineNo: i + 1,
      itemName: line.itemName || line.description,
      itemDescription: line.description ?? '',
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
