// Invoice form field definitions — derived from StoneSuite_Forms.xlsx "Invoice" sheet.
// Only fields NOT marked "Don't Display in UI" are included here
// (excluded: Tenant ID, Stone Suite Customer ID, Record Type, Invoice ID).

import { US_STATES, COUNTRIES, PAYMENT_TERMS_OPTIONS, PRICE_LEVEL_OPTIONS } from '@/lib/salesOrderForm';

export interface InvoiceFormField {
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

export { US_STATES, COUNTRIES, PAYMENT_TERMS_OPTIONS, PRICE_LEVEL_OPTIONS };

export const INVOICE_STATUSES = [
  '', 'Draft', 'Sent', 'Partially Paid', 'Paid', 'Overdue', 'Void', 'Cancelled',
];

// ── Form section field definitions ───────────────────────────────────────────

export const PRIMARY_INFO_FIELDS: InvoiceFormField[] = [
  {
    key: 'invoice_status',
    label: 'Invoice Status',
    type: 'select',
    required: true,
    options: INVOICE_STATUSES,
  },
  {
    key: 'invoice_doc_num',
    label: 'Invoice #',
    type: 'readonly',
    placeholder: 'Auto-generated',
  },
  {
    key: 'sales_doc_num',
    label: 'Sales Order #',
    type: 'text',
    placeholder: 'Referenced sales order number',
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
    key: 'invoice_date',
    label: 'Invoice Date',
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
    options: PAYMENT_TERMS_OPTIONS,
  },
  {
    key: 'memo',
    label: 'Memo',
    type: 'textarea',
    placeholder: 'Notes related to this invoice…',
    colSpanFull: true,
  },
];

export const BILL_TO_FIELDS: InvoiceFormField[] = [
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
    key: 'price_level',
    label: 'Price Level',
    type: 'select',
    options: PRICE_LEVEL_OPTIONS,
  },
];

export const SHIP_TO_FIELDS: InvoiceFormField[] = [
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

export const SALES_INFO_FIELDS: InvoiceFormField[] = [
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

export interface InvoiceLineItem {
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

export const EMPTY_LINE_ITEM: Omit<InvoiceLineItem, 'id' | 'lineNo'> = {
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

export function calcLineItem(item: Omit<InvoiceLineItem, 'id' | 'lineNo' | 'amount' | 'total'>): { amount: string; total: string } {
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

// ── Form defaults ─────────────────────────────────────────────────────────────

export function invoiceDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    date_created: today,
    invoice_date: today,
    invoice_status: 'Draft',
    ship_same_as_bill: false,
    bill_country: 'United States',
    ship_country: 'United States',
    amount_paid: '0',
  };
}
