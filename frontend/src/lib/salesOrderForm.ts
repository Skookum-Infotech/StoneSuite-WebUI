// Sales Order form field definitions — derived from StoneSuite_Forms.xlsx "Sales Order" sheet.
// Only fields NOT marked "Don't Display in UI" are included here.

export interface SOFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'email' | 'tel' | 'number' | 'date' | 'readonly';
  required?: boolean;
  options?: string[];
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

// ── Lookup option lists ───────────────────────────────────────────────────────

export const US_STATES = [
  '', 'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado',
  'Connecticut', 'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho',
  'Illinois', 'Indiana', 'Iowa', 'Kansas', 'Kentucky', 'Louisiana',
  'Maine', 'Maryland', 'Massachusetts', 'Michigan', 'Minnesota', 'Mississippi',
  'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire', 'New Jersey',
  'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio', 'Oklahoma',
  'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington',
  'West Virginia', 'Wisconsin', 'Wyoming',
];

export const COUNTRIES = [
  '', 'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany',
  'France', 'Japan', 'India', 'Brazil', 'Mexico', 'China', 'Singapore', 'Other',
];

export const PAYMENT_TERMS_OPTIONS = [
  '', 'Due on Receipt', 'Net 15', 'Net 30', 'Net 45', 'Net 60', 'Net 90', 'COD',
];

export const PRICE_LEVEL_OPTIONS = [
  '', 'Standard', 'Online Price', 'Partner Price', 'Wholesale', 'Retail', 'Custom',
];

export const SO_STATUSES = [
  '', 'Pending Fulfillment', 'Pending Billing / Partially Fulfilled',
  'Pending Billing', 'Fulfilled', 'Billed', 'Cancelled', 'Closed',
];

// ── Form section field definitions ───────────────────────────────────────────

export const PRIMARY_INFO_FIELDS: SOFormField[] = [
  {
    key: 'sales_order_status',
    label: 'Sales Order Status',
    type: 'select',
    required: true,
    options: SO_STATUSES,
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
    key: 'memo',
    label: 'Memo',
    type: 'textarea',
    placeholder: 'Notes related to this sales order…',
    colSpanFull: true,
  },
];

export const BILL_TO_FIELDS: SOFormField[] = [
  {
    key: 'bill_customer',
    label: 'Billing Customer',
    type: 'text',
    required: true,
    placeholder: 'Billing customer name',
  },
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
  { key: 'bill_state', label: 'State', type: 'select', options: US_STATES },
  {
    key: 'bill_zip',
    label: 'Zip / Postal Code',
    type: 'text',
    placeholder: '12345',
  },
  { key: 'bill_country', label: 'Country', type: 'select', options: COUNTRIES },
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
    options: PAYMENT_TERMS_OPTIONS,
  },
  {
    key: 'price_level',
    label: 'Price Level',
    type: 'select',
    options: PRICE_LEVEL_OPTIONS,
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
    key: 'ship_state',
    label: 'State',
    type: 'select',
    showIfFieldFalse: 'ship_same_as_bill',
    options: US_STATES,
  },
  {
    key: 'ship_zip',
    label: 'Zip / Postal Code',
    type: 'text',
    showIfFieldFalse: 'ship_same_as_bill',
    placeholder: '12345',
  },
  {
    key: 'ship_country',
    label: 'Country',
    type: 'select',
    showIfFieldFalse: 'ship_same_as_bill',
    options: COUNTRIES,
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

export const SALES_INFO_FIELDS: SOFormField[] = [
  {
    key: 'sales_rep',
    label: 'Sales Rep',
    type: 'text',
    placeholder: 'Assigned sales representative',
  },
  {
    key: 'customer_owner',
    label: 'Customer Owner',
    type: 'text',
    placeholder: 'Account owner',
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

// ── Form defaults ─────────────────────────────────────────────────────────────

export function soDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    date_created: today,
    sales_order_status: 'Pending Fulfillment',
    ship_same_as_bill: false,
    bill_country: 'United States',
    ship_country: 'United States',
    sales_tax_pct: '0',
  };
}
