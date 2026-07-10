// Sales Order form field definitions — derived from StoneSuite_Forms.xlsx "Sales Order" sheet.
// Field keys are UI-facing (map to the create payload via toCreatePayload, not
// sent to the backend verbatim) so the form can stay close to the original
// workbook layout while the wire contract stays ID-based (spec §10).

import type { CrmLookups } from '@/services/lookupService';
import type { SalesOrder, SalesOrderCreatePayload, SalesOrderLineInput } from '@/types/salesOrder';

export const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'drawings', label: 'Drawings' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;
export type PageTab = (typeof PAGE_TABS)[number]['key'];

export interface SOFormField {
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
}

// ── Form section field definitions ───────────────────────────────────────────

export const PRIMARY_INFO_FIELDS: SOFormField[] = [
  {
    key: 'sales_order_status',
    label: 'Sales Order Status',
    type: 'readonly',
    placeholder: 'Draft',
  },
  {
    key: 'sales_doc_num',
    label: 'Sales Order #',
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
    key: 'date_created',
    label: 'Date Created',
    type: 'date',
    required: true,
  },
  {
    key: 'sales_tax_pct',
    label: 'Sales Tax %',
    type: 'number',
    placeholder: '0.00',
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
    placeholder: 'Notes related to this sales order…',
    colSpanFull: true,
  },
];

// bill_customer/bill_customer_uuid are handled by a dedicated customer picker
// (CustomerPicker) in AddSalesOrderPage, not the generic SOSectionGrid — a
// customer is a searchable record, not a static lookup list.
export const BILL_TO_FIELDS: SOFormField[] = [
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

export const SHIP_TO_FIELDS: SOFormField[] = [
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
// `employees` lookup rather than free text, matching sales_order_sales_rep_id
// / sales_order_owner_id (employee FKs) on the create payload.
export const SALES_INFO_FIELDS: SOFormField[] = [
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

export interface SOLineItem {
  id: string;
  lineNo: number;
  itemName: string;
  itemDescription: string;
  itemSku: string;
  quantity: string;
  units: string;
  unitPrice: string;
  discount: string;
  amount: string;   // calculated
  tax: string;
  total: string;    // calculated
  /** Catalog reference — set when the line was picked from the inventory
   *  catalog (maps to the create payload's `inventoryItemUuid`). Absent for
   *  free-text lines. */
  inventoryItemUuid?: string;
  /** Selected `lkp_tax_rate` id, when a line uses a named tax rate rather than
   *  the header default. */
  taxRateId?: number | null;
}

export const EMPTY_LINE_ITEM: Omit<SOLineItem, 'id' | 'lineNo'> = {
  itemName: '',
  itemDescription: '',
  itemSku: '',
  quantity: '',
  units: '',
  unitPrice: '',
  discount: '0',
  amount: '',
  tax: '0',
  total: '',
};

export function calcLineItem(item: Omit<SOLineItem, 'id' | 'lineNo' | 'amount' | 'total'>): { amount: string; total: string } {
  const qty = parseFloat(item.quantity) || 0;
  const price = parseFloat(item.unitPrice) || 0;
  const disc = parseFloat(item.discount) || 0;
  const tax = parseFloat(item.tax) || 0;
  const amount = qty * price * (1 - disc / 100);
  const total = amount * (1 + tax / 100);
  return {
    amount: qty && price ? amount.toFixed(2) : '',
    total: qty && price ? total.toFixed(2) : '',
  };
}

// ── Inventory sub-tab ─────────────────────────────────────────────────────────

export interface SOInventoryItem {
  id: string;
  itemName: string;
  itemSku: string;
  onhandQty: number;
  availableQty: number;
  salesOrderQty: number;
  allocatedQty: number;
}

// ── Drawings sub-tab ──────────────────────────────────────────────────────────

export type DrawingType =
  | 'floor_plan'
  | 'elevation'
  | 'section'
  | 'detail'
  | 'fabrication'
  | 'installation'
  | 'shop_drawing'
  | 'as_built'
  | 'other';

export type DrawingStatus = 'draft' | 'pending_review' | 'approved' | 'rejected';

export interface SODrawing {
  id: string;
  name: string;
  type: DrawingType;
  revision: string;
  status: DrawingStatus;
  fileName: string;
  fileSize: number;
  uploadedBy: string;
  uploadedAt: string;
  notes: string;
}

export const DRAWING_TYPE_LABELS: Record<DrawingType, string> = {
  floor_plan: 'Floor Plan',
  elevation: 'Elevation',
  section: 'Section',
  detail: 'Detail',
  fabrication: 'Fabrication',
  installation: 'Installation',
  shop_drawing: 'Shop Drawing',
  as_built: 'As-Built',
  other: 'Other',
};

export const DRAWING_STATUS_CONFIG: Record<DrawingStatus, { label: string; bg: string; text: string }> = {
  draft:          { label: 'Draft',          bg: 'bg-stone-100',   text: 'text-stone-600' },
  pending_review: { label: 'Pending Review', bg: 'bg-amber-100',   text: 'text-amber-700' },
  approved:       { label: 'Approved',       bg: 'bg-emerald-100', text: 'text-emerald-700' },
  rejected:       { label: 'Rejected',       bg: 'bg-red-100',     text: 'text-red-700' },
};

// ── Status catalog (backend spec §8 — fixed, forward-only state machine) ─────

/** Every `lkp_record_status` row seeded for the SORD record type. The backend
 *  (`salesorder.ValidateTransition`) is the source of truth for which moves
 *  are actually legal from a given status — this list only drives the Edit
 *  page's "change status" select; an illegal pick is rejected server-side
 *  with a 409, surfaced as a normal save error. */
export const SO_STATUS_CODES: { code: string; label: string }[] = [
  { code: 'DRFT', label: 'Draft' },
  { code: 'PAPV', label: 'Pending Approval' },
  { code: 'APPV', label: 'Approved' },
  { code: 'OPEN', label: 'Open' },
  { code: 'PART', label: 'Partially Filled' },
  { code: 'FILL', label: 'Filled' },
  { code: 'CANC', label: 'Cancelled' },
];

/** Status badge color, keyed by the human label (matches SO_STATUS_CODES'
 *  labels) — shared by the list table and the detail page. */
export const SO_STATUS_COLORS: Record<string, string> = {
  Draft: '#a8a29e',
  'Pending Approval': '#f59e0b',
  Approved: '#3b82f6',
  Open: '#6366f1',
  'Partially Filled': '#f59e0b',
  Filled: '#10b981',
  Cancelled: '#ef4444',
};

// ── Form defaults ─────────────────────────────────────────────────────────────

export function soDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    date_created: today,
    sales_order_status: 'Draft',
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

/** Maps one editable line row to the create/update contract's line shape.
 *  A row with `inventoryItemUuid` set is a catalog line (server snapshots its
 *  sku/name/description/unit/price/tax); otherwise it's free-text and needs
 *  `itemDescription`. */
function toLineInput(item: SOLineItem): SalesOrderLineInput {
  return {
    lineNumber: item.lineNo,
    inventoryItemUuid: item.inventoryItemUuid || undefined,
    description: item.itemDescription || item.itemName || undefined,
    quantity: toNum(item.quantity),
    unitPrice: toNum(item.unitPrice),
    discountPercent: toNum(item.discount),
    taxRateId: item.taxRateId ?? undefined,
  };
}

/** Maps the AddSalesOrderPage form state + line items to the backend's
 *  `SalesOrderCreatePayload` (spec §10). `customerUuid` comes from the
 *  CustomerPicker's selection (stored under `customer_uuid` in form state) —
 *  the free-text `bill_customer` display name is never sent, only the id.
 *  Status is intentionally omitted: every new order starts at DRFT
 *  server-side; status changes go through the `/transition` endpoint. */
export function toCreatePayload(
  data: Record<string, unknown>,
  lineItems: SOLineItem[],
): SalesOrderCreatePayload {
  const shipSameAsBilling = Boolean(data.ship_same_as_bill);

  return {
    customerUuid: toStr(data.customer_uuid),
    poNumber: toStr(data.purchase_doc_num),
    orderDate: toStr(data.date_created),
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
    items: lineItems.map(toLineInput),
  };
}

/** id-or-empty for a lookupKey <select>'s bound value: null/undefined must
 *  render as "— Select —" (empty string), never "0" or "null". */
function idOrEmpty(id: number | null | undefined): string {
  return id === null || id === undefined ? '' : String(id);
}

/** Maps a loaded SalesOrder (GET response) back to the Edit form's state —
 *  the inverse of toCreatePayload. Customer is returned separately since it's
 *  driven by CustomerPicker's own state, not a plain form field. */
export function fromOrder(order: SalesOrder): {
  data: Record<string, unknown>;
  lineItems: SOLineItem[];
  customer: { id: string; name: string };
} {
  const data: Record<string, unknown> = {
    sales_order_status: order.status,
    sales_doc_num: order.salesOrderNumber,
    purchase_doc_num: order.poNumber ?? '',
    date_created: order.orderDate,
    sales_tax_pct: String(order.salesTaxPercent ?? 0),
    currency_id: idOrEmpty(order.currencyId),
    memo: order.memo ?? '',
    bill_attn: order.billing.attention ?? '',
    bill_address1: order.billing.addrLine1 ?? '',
    bill_address2: order.billing.addrLine2 ?? '',
    bill_suite: order.billing.suiteUnit ?? '',
    bill_city: order.billing.city ?? '',
    bill_state: idOrEmpty(order.billing.stateId),
    bill_country: idOrEmpty(order.billing.countryId),
    bill_zip: order.billing.zip ?? '',
    bill_phone: order.billing.phone ?? '',
    bill_fax: order.billing.fax ?? '',
    bill_email: order.billing.email ?? '',
    payment_terms: idOrEmpty(order.paymentTermsId),
    price_level: idOrEmpty(order.priceLevelId),
    ship_same_as_bill: order.shipSameAsBilling,
    ship_customer: order.shipping.customerName ?? '',
    ship_attn: order.shipping.attention ?? '',
    ship_address1: order.shipping.addrLine1 ?? '',
    ship_address2: order.shipping.addrLine2 ?? '',
    ship_suite: order.shipping.suiteUnit ?? '',
    ship_city: order.shipping.city ?? '',
    ship_state: idOrEmpty(order.shipping.stateId),
    ship_country: idOrEmpty(order.shipping.countryId),
    ship_zip: order.shipping.zip ?? '',
    ship_phone: order.shipping.phone ?? '',
    ship_fax: order.shipping.fax ?? '',
    ship_email: order.shipping.email ?? '',
    sales_rep: idOrEmpty(order.salesRepEmployeeId),
    customer_owner: idOrEmpty(order.ownerEmployeeId),
  };

  const lineItems: SOLineItem[] = order.items.map((line, i) => ({
    id: `existing-${i}`,
    lineNo: line.lineNumber,
    itemName: line.itemName,
    itemDescription: line.description,
    itemSku: line.sku,
    quantity: String(line.quantity),
    units: line.unitCode,
    unitPrice: String(line.unitPrice),
    discount: String(line.discountPercent),
    amount: line.lineSubtotal.toFixed(2),
    tax: String(line.taxPercent),
    total: line.lineTotal.toFixed(2),
    inventoryItemUuid: line.inventoryItemId ?? undefined,
  }));

  return { data, lineItems, customer: { id: order.customer.id, name: order.customer.name } };
}
