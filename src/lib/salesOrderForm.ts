export type SOFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'email'
  | 'tel'
  | 'number'
  | 'date';

export interface SOField {
  key: string;
  label: string;
  type?: SOFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  readOnly?: boolean;
  defaultValue?: string | boolean;
}

export interface SOSection {
  title: string;
  fields: SOField[];
}

export interface SOTab {
  key: string;
  label: string;
  sections: SOSection[];
}

export interface SOLineItem {
  id: string;
  item: string;
  quantity: string;
  units: string;
  description: string;
  priceLevel: string;
  rate: string;
  amount: string;
  commit: boolean;
  commitmentConfirmed: boolean;
  orderPriority: string;
  grossAmt: string;
}

// ── Primary Information ───────────────────────────────────────────────────────

export const PRIMARY_INFO_FIELDS: SOField[] = [
  {
    key: 'custom_form',
    label: 'Custom Form',
    type: 'select',
    required: true,
    options: ['Standard Sales Order'],
    defaultValue: 'Standard Sales Order',
  },
  {
    key: 'order_number',
    label: 'Order #',
    readOnly: true,
    placeholder: 'Auto-generated',
  },
  {
    key: 'customer_project',
    label: 'Customer : Project',
    required: true,
    placeholder: '<Type then tab>',
  },
  { key: 'date', label: 'Date', type: 'date', required: true },
  {
    key: 'status',
    label: 'Status',
    type: 'select',
    required: true,
    options: [
      'Pending Fulfillment',
      'Pending Billing/Partially Fulfilled',
      'Pending Billing',
      'Billed',
      'Cancelled',
      'Closed',
    ],
    defaultValue: 'Pending Fulfillment',
  },
  { key: 'start_date', label: 'Start Date', type: 'date' },
  { key: 'end_date', label: 'End Date', type: 'date' },
  { key: 'po_number', label: 'PO #' },
  { key: 'memo', label: 'Memo', type: 'textarea' },
];

// ── Sales Information ─────────────────────────────────────────────────────────

export const SALES_INFO_FIELDS: SOField[] = [
  {
    key: 'sales_rep',
    label: 'Sales Rep',
    type: 'select',
    options: ['', 'Alex Johnson', 'Maria Garcia', 'James Lee', 'Sarah Chen', 'David Kim'],
  },
  { key: 'sales_effective_date', label: 'Sales Effective Date', type: 'date' },
  {
    key: 'partner',
    label: 'Partner',
    type: 'select',
    options: ['', 'Accenture', 'Deloitte Digital', 'KPMG', 'PwC', 'Salesforce Partner Network', 'None'],
  },
];

// ── Classification ────────────────────────────────────────────────────────────

export const CLASSIFICATION_FIELDS: SOField[] = [
  {
    key: 'subsidiary',
    label: 'Subsidiary',
    type: 'select',
    required: true,
    options: [
      '',
      'Talkdesk Inc.',
      'Talkdesk UK Ltd.',
      'Talkdesk Portugal',
      'Talkdesk Germany GmbH',
      'Talkdesk Australia Pty Ltd.',
    ],
  },
  {
    key: 'class',
    label: 'Class',
    type: 'select',
    options: ['', 'Enterprise', 'Mid-Market', 'SMB', 'Partner', 'Internal'],
  },
  {
    key: 'china_cash_flow_item',
    label: 'China Cash Flow Item',
    type: 'select',
    options: ['', 'Not Applicable', 'Operating', 'Investing', 'Financing'],
  },
  {
    key: 'department',
    label: 'Department',
    type: 'select',
    options: ['', 'Sales', 'Engineering', 'Finance', 'Operations', 'HR', 'Marketing'],
  },
  {
    key: 'location',
    label: 'Location',
    type: 'select',
    options: [
      '',
      'US – New York',
      'US – San Francisco',
      'UK – London',
      'Portugal – Lisbon',
      'Germany – Munich',
      'Australia – Sydney',
    ],
  },
];

// ── Intercompany Management ───────────────────────────────────────────────────

export const INTERCOMPANY_FIELDS: SOField[] = [
  { key: 'paired_intercompany_transaction', label: 'Paired Intercompany Transaction', placeholder: '<Type then tab>' },
  { key: 'intercompany_status', label: 'Intercompany Status' },
  { key: 'zuora_payment_number', label: 'Zuora Payment Number' },
  { key: 'customer_notes', label: 'Customer Notes' },
  { key: 'local_amount_due', label: 'Local Amount Due', type: 'number', required: true },
  { key: 'zuora_invoice_number', label: 'Zuora Invoice Number' },
  {
    key: 'e_commerce_operator',
    label: 'E-Commerce Operator',
    type: 'select',
    options: ['', 'Amazon', 'eBay', 'Shopify', 'WooCommerce', 'Magento', 'Other'],
  },
  { key: 'local_inv_amt', label: 'Local Inv Amt', type: 'number', required: true },
  { key: 'document_date', label: 'Document Date', type: 'date' },
  {
    key: 'e_commerce_gstin',
    label: 'E-Commerce GSTIN',
    type: 'select',
    options: ['', 'Registered', 'Unregistered', 'Composite', 'SEZ'],
  },
  {
    key: 'local_invoice',
    label: 'Local Invoice',
    type: 'select',
    required: true,
    options: ['', 'Yes', 'No'],
  },
  { key: 'customer_vat', label: 'Customer VAT #' },
  {
    key: 'export_type',
    label: 'Export Type',
    type: 'select',
    options: ['', 'WPAY', 'WOPAY', 'SEZ WPAY', 'SEZ WOPAY', 'Deemed Exports'],
  },
  { key: 'credit_amount', label: 'Credit Amount', type: 'number', readOnly: true },
  {
    key: 'exclude_from_electronic_bank_payments',
    label: 'Exclude From Electronic Bank Payments Processing',
    type: 'checkbox',
  },
  {
    key: 'place_of_supply',
    label: 'Place of Supply',
    type: 'select',
    options: [
      '',
      'IN-AP', 'IN-AR', 'IN-AS', 'IN-BR', 'IN-CG', 'IN-CH', 'IN-DL',
      'IN-GA', 'IN-GJ', 'IN-HP', 'IN-HR', 'IN-JH', 'IN-JK', 'IN-KA',
      'IN-KL', 'IN-MH', 'IN-ML', 'IN-MN', 'IN-MP', 'IN-MZ', 'IN-NL',
      'IN-OR', 'IN-PB', 'IN-PY', 'IN-RJ', 'IN-SK', 'IN-TG', 'IN-TN',
      'IN-TR', 'IN-UP', 'IN-UT', 'IN-WB',
    ],
  },
  { key: 'paid_amount', label: 'Paid Amount', type: 'number', readOnly: true },
  { key: 'amount_remaining_on_invoice', label: 'Amount Remaining on Invoice', type: 'number', readOnly: true },
  { key: 'local_invoice_number', label: 'Local Invoice #', required: true },
  {
    key: 'write_off_journal',
    label: 'Write-Off Journal',
    type: 'select',
    options: ['', 'General Ledger', 'Accounts Receivable', 'Write-Off'],
  },
  { key: 'follow_up_date', label: 'Follow Up Date', type: 'date' },
  {
    key: 'dunning_status',
    label: 'Status',
    type: 'select',
    options: ['Normal Dunning', 'Suspended', 'On Hold'],
    defaultValue: 'Normal Dunning',
  },
  { key: 'white_glove_review_required', label: 'White Glove Review Required', type: 'checkbox' },
  { key: 'dunning_suspension', label: 'Dunning Suspension', type: 'checkbox' },
];

// ── Tabs ──────────────────────────────────────────────────────────────────────

export const SO_TABS: SOTab[] = [
  { key: 'items', label: 'Items', sections: [] },
  {
    key: 'shipping',
    label: 'Shipping',
    sections: [
      {
        title: 'Shipping',
        fields: [
          { key: 'ship_date', label: 'Ship Date', type: 'date' },
          {
            key: 'ship_method',
            label: 'Ship Method',
            type: 'select',
            options: ['', 'Standard', 'Express', 'Overnight', 'International'],
          },
          { key: 'tracking_number', label: 'Tracking Number' },
          { key: 'shipping_cost', label: 'Shipping Cost', type: 'number' },
          { key: 'ship_to', label: 'Ship To', type: 'textarea' },
        ],
      },
    ],
  },
  {
    key: 'billing',
    label: 'Billing',
    sections: [
      {
        title: 'Billing',
        fields: [
          {
            key: 'payment_terms',
            label: 'Payment Terms',
            type: 'select',
            options: ['', 'Net 30', 'Net 60', 'Net 90', 'Due on Receipt', 'Net 15'],
          },
          { key: 'bill_to', label: 'Bill To', type: 'textarea' },
          {
            key: 'payment_method',
            label: 'Payment Method',
            type: 'select',
            options: ['', 'Credit Card', 'ACH', 'Wire Transfer', 'Check', 'Invoice'],
          },
        ],
      },
    ],
  },
  {
    key: 'accounting',
    label: 'Accounting',
    sections: [
      {
        title: 'Accounting',
        fields: [
          {
            key: 'revenue_recognition_rule',
            label: 'Revenue Recognition Rule',
            type: 'select',
            options: ['', 'Immediate', 'Straight-line', 'Event-based'],
          },
          { key: 'deferred_revenue_account', label: 'Deferred Revenue Account' },
          { key: 'revenue_account', label: 'Revenue Account' },
          { key: 'cogs_account', label: 'Cost of Goods Sold Account' },
        ],
      },
    ],
  },
  {
    key: 'tax_details',
    label: 'Tax Details',
    sections: [
      {
        title: 'Tax Details',
        fields: [
          {
            key: 'tax_code',
            label: 'Tax Code',
            type: 'select',
            options: ['', 'US-CA', 'US-NY', 'EU-VAT', 'UK-VAT', 'IN-GST', 'AU-GST'],
          },
          { key: 'tax_rate', label: 'Tax Rate (%)', type: 'number' },
          {
            key: 'nexus',
            label: 'Nexus',
            type: 'select',
            options: ['', 'California', 'New York', 'Texas', 'Florida'],
          },
        ],
      },
    ],
  },
  { key: 'relationships', label: 'Relationships', sections: [] },
  { key: 'communication', label: 'Communication', sections: [] },
  { key: 'related_records', label: 'Related Records', sections: [] },
  { key: 'system_information', label: 'System Information', sections: [] },
  { key: 'custom', label: 'Custom', sections: [] },
  { key: 'accounting_books', label: 'Accounting Books', sections: [] },
  { key: 'eft', label: 'EFT', sections: [] },
  { key: 'tax_reporting', label: 'Tax Reporting', sections: [] },
  { key: 'zuora_subscription', label: 'Zuora Subscription', sections: [] },
];

// ── Defaults ──────────────────────────────────────────────────────────────────

export function salesOrderDefaults(): Record<string, unknown> {
  const today = new Date().toISOString().split('T')[0];
  const allFields: SOField[] = [
    ...PRIMARY_INFO_FIELDS,
    ...SALES_INFO_FIELDS,
    ...CLASSIFICATION_FIELDS,
    ...INTERCOMPANY_FIELDS,
    ...SO_TABS.flatMap((t) => t.sections.flatMap((s) => s.fields)),
  ];
  const out: Record<string, unknown> = { date: today };
  for (const f of allFields) {
    if (f.type === 'checkbox') {
      out[f.key] = f.defaultValue === true;
    } else if (f.defaultValue !== undefined && f.defaultValue !== false) {
      out[f.key] = f.defaultValue;
    }
  }
  return out;
}
