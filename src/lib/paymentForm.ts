// Payment form field definitions — mirrors the shape of invoiceForm.ts, scoped
// down to the fields a customer payment record actually needs (no line items).

export interface PaymentFormField {
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
  /** Textarea row count (only used when type === 'textarea') */
  rows?: number;
}

export const PAYMENT_STATUSES = [
  '', 'Pending', 'Completed', 'Failed', 'Refunded', 'Void',
];

export const PAYMENT_METHOD_OPTIONS = [
  '', 'Cash', 'Check', 'Credit Card', 'Debit Card', 'ACH / Bank Transfer', 'Wire Transfer', 'PayPal', 'Other',
];

// ── Form section field definitions ───────────────────────────────────────────

export const PRIMARY_INFO_FIELDS: PaymentFormField[] = [
  { key: 'payment_status', label: 'Payment Status', type: 'select', required: true, options: PAYMENT_STATUSES },
  { key: 'payment_doc_num', label: 'Payment #', type: 'readonly', placeholder: 'Auto-generated' },
  { key: 'invoice_doc_num', label: 'Invoice #', type: 'text', placeholder: 'Referenced invoice number' },
  { key: 'payment_date', label: 'Payment Date', type: 'date', required: true },
  { key: 'payment_method', label: 'Payment Method', type: 'select', required: true, options: PAYMENT_METHOD_OPTIONS },
  { key: 'reference_num', label: 'Reference / Check #', type: 'text', placeholder: 'Enter reference or check number' },
  { key: 'amount', label: 'Amount', type: 'number', required: true, placeholder: '0.00' },
  { key: 'memo', label: 'Memo', type: 'textarea', placeholder: 'Notes related to this payment…', colSpanFull: true },
];

export const CUSTOMER_FIELDS: PaymentFormField[] = [
  { key: 'customer_name', label: 'Customer', type: 'text', required: true, placeholder: 'Customer name' },
  { key: 'customer_contact_email', label: 'Email', type: 'email', placeholder: 'customer@company.com' },
  { key: 'customer_phone', label: 'Phone', type: 'tel', placeholder: '+1 (555) 000-0000' },
];

// ── Form defaults ─────────────────────────────────────────────────────────────

export function paymentDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  return {
    payment_date: today,
    payment_status: 'Pending',
  };
}
