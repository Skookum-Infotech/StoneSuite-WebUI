// Declarative configuration for the NetSuite-style Prospect form. Keeping the
// layout data-driven (like the OnboardingForm) means the create form, the
// read-only view, and the list summary all stay in sync from one source.
//
// All values are stored in a workflow record's free-form `coreFields`, so any
// key added here is persisted without backend changes.

export type ProspectFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'email'
  | 'tel'
  | 'url'
  | 'number';

export interface ProspectField {
  key: string;
  label: string;
  type?: ProspectFieldType; // defaults to 'text'
  required?: boolean;
  options?: string[]; // for 'select'
  placeholder?: string;
  readOnly?: boolean;
  defaultValue?: string; // 'true' / 'false' for checkboxes
}

export interface ProspectSection {
  title: string;
  fields: ProspectField[];
}

export interface ProspectTab {
  key: string;
  label: string;
  sections: ProspectSection[];
}

// ---- Always-visible header sections ----------------------------------------

export const PRIMARY_SECTIONS: ProspectSection[] = [
  {
    title: 'Primary Information',
    fields: [
      {
        key: 'custom_form',
        label: 'Custom Form',
        type: 'select',
        required: true,
        options: ['Talkdesk Customer Form', 'Standard Customer Form'],
        defaultValue: 'Talkdesk Customer Form',
      },
      {
        key: 'status',
        label: 'Status',
        type: 'select',
        required: true,
        options: [
          'PROSPECT-In Discussion',
          'PROSPECT-Identified Decision Makers',
          'PROSPECT-Qualified',
          'LEAD-New',
          'CUSTOMER-Closed Won',
          'CUSTOMER-Renewal',
        ],
        defaultValue: 'PROSPECT-In Discussion',
      },
      { key: 'comments', label: 'Comments', type: 'textarea' },
      { key: 'customer_id', label: 'Customer ID', readOnly: true, placeholder: 'To Be Generated' },
      { key: 'customer_id_auto', label: 'Auto-generate ID', type: 'checkbox', defaultValue: 'true' },
      { key: 'parent_company', label: 'Parent Company', placeholder: '<Type then tab>' },
      {
        key: 'sfdc_customer_status',
        label: 'SFDC Customer Status',
        type: 'select',
        options: ['Active', 'Inactive', 'On Hold'],
      },
      { key: 'company_name', label: 'Company Name', required: true },
      { key: 'zuora_invoice_name', label: 'Zuora Invoice Name' },
      {
        key: 'account_status',
        label: 'Account Status',
        type: 'select',
        options: ['Active', 'Inactive', 'Suspended'],
      },
      {
        key: 'customer_type',
        label: 'Customer Type',
        type: 'select',
        options: ['Customer', 'Partner', 'Vendor'],
        defaultValue: 'Customer',
      },
      {
        key: 'ar_status',
        label: 'AR Status',
        type: 'select',
        options: ['Current', 'Past Due', 'In Collections'],
      },
      { key: 'billing_account_name', label: 'Billing Account Name' },
    ],
  },
  {
    title: 'Email | Phone | Address',
    fields: [
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'multiple_email_invoices', label: 'Multiple Email Addresses for Invoices' },
      { key: 'alt_phone', label: 'Alt. Phone', type: 'tel' },
    ],
  },
  {
    title: 'Classification',
    fields: [
      {
        key: 'subsidiary',
        label: 'Subsidiary',
        type: 'select',
        required: true,
        options: ['Talkdesk Inc.', 'Talkdesk UK Ltd.', 'Talkdesk Portugal'],
      },
      { key: 'talkdesk_region', label: 'Talkdesk Region' },
      { key: 'talkdesk_id_platform', label: 'Talkdesk ID Platform' },
      { key: 'web_address', label: 'Web Address', type: 'url' },
      { key: 'crm_account_owner', label: 'CRM Account Owner' },
      { key: 'ar_analyst', label: 'AR Analyst' },
      { key: 'crm_csm', label: 'CRM CSM' },
      { key: 'crm_csm_team', label: 'CRM CSM Team' },
      { key: 'crm_growth_manager', label: 'CRM Growth Manager' },
      { key: 'white_glove', label: 'White Glove', type: 'checkbox' },
      { key: 'display_product_code', label: 'Display Product Code', type: 'checkbox' },
    ],
  },
];

// ---- Tabbed sections --------------------------------------------------------

export const TABS: ProspectTab[] = [
  {
    key: 'sales',
    label: 'Sales',
    sections: [
      {
        title: 'Sales',
        fields: [
          {
            key: 'territory',
            label: 'Territory',
            type: 'select',
            options: ['North America', 'EMEA', 'APAC', 'LATAM'],
          },
        ],
      },
      {
        title: 'Qualification',
        fields: [
          { key: 'estimated_budget', label: 'Estimated Budget', type: 'number' },
          { key: 'budget_approved', label: 'Budget Approved', type: 'checkbox' },
          {
            key: 'sales_readiness',
            label: 'Sales Readiness',
            type: 'select',
            options: ['Marketing Qualified', 'Sales Qualified', 'Sales Ready'],
          },
          {
            key: 'buying_reason',
            label: 'Buying Reason',
            type: 'select',
            options: ['Expansion', 'Replacement', 'New Initiative', 'Evaluation'],
          },
          {
            key: 'buying_time_frame',
            label: 'Buying Time Frame',
            type: 'select',
            options: ['Immediate', '1-3 months', '3-6 months', '6-12 months'],
          },
        ],
      },
    ],
  },
  {
    key: 'financial',
    label: 'Financial',
    sections: [
      {
        title: 'Financial',
        fields: [
          { key: 'credit_limit', label: 'Credit Limit', type: 'number' },
          {
            key: 'payment_terms',
            label: 'Payment Terms',
            type: 'select',
            options: ['Net 15', 'Net 30', 'Net 45', 'Net 60', 'Due on receipt'],
          },
          {
            key: 'currency',
            label: 'Currency',
            type: 'select',
            options: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'],
          },
          { key: 'tax_id', label: 'Tax / VAT ID' },
        ],
      },
    ],
  },
  {
    key: 'subsidiaries',
    label: 'Subsidiaries',
    sections: [
      {
        title: 'Subsidiaries',
        fields: [
          {
            key: 'primary_subsidiary',
            label: 'Primary Subsidiary',
            type: 'select',
            options: ['Talkdesk Inc.', 'Talkdesk UK Ltd.', 'Talkdesk Portugal'],
          },
          { key: 'consolidated_balance', label: 'Consolidated Balance', type: 'number' },
        ],
      },
    ],
  },
  {
    key: 'address',
    label: 'Address',
    sections: [
      {
        title: 'Address',
        fields: [
          { key: 'default_billing_address', label: 'Default Billing Address', type: 'textarea' },
          { key: 'default_shipping_address', label: 'Default Shipping Address', type: 'textarea' },
        ],
      },
    ],
  },
  {
    key: 'relationships',
    label: 'Relationships',
    sections: [
      {
        title: 'Relationships',
        fields: [
          { key: 'sales_rep', label: 'Sales Rep' },
          { key: 'partner', label: 'Partner' },
          { key: 'primary_contact', label: 'Primary Contact' },
          { key: 'contact_role', label: 'Contact Role' },
        ],
      },
    ],
  },
  {
    key: 'communication',
    label: 'Communication',
    sections: [
      {
        title: 'Communication',
        fields: [
          {
            key: 'preferred_channel',
            label: 'Preferred Channel',
            type: 'select',
            options: ['Email', 'Phone', 'SMS', 'Portal'],
          },
          { key: 'email_preference', label: 'Email Preference' },
          { key: 'unsubscribe_all', label: 'Unsubscribe From All', type: 'checkbox' },
        ],
      },
    ],
  },
  {
    key: 'zab_subscriptions',
    label: 'ZAB Subscriptions',
    sections: [
      {
        title: 'ZAB Subscriptions',
        fields: [
          { key: 'zab_account_id', label: 'ZAB Account ID' },
          { key: 'subscription_plan', label: 'Subscription Plan' },
          {
            key: 'billing_cycle',
            label: 'Billing Cycle',
            type: 'select',
            options: ['Monthly', 'Quarterly', 'Annual'],
          },
        ],
      },
    ],
  },
  {
    key: 'zuora_sync',
    label: 'Zuora Sync Details',
    sections: [
      {
        title: 'Zuora Sync Details',
        fields: [
          { key: 'zuora_account_id', label: 'Zuora Account ID' },
          { key: 'sync_status', label: 'Sync Status', type: 'select', options: ['Synced', 'Pending', 'Failed'] },
          { key: 'last_synced', label: 'Last Synced' },
        ],
      },
    ],
  },
  {
    key: 'zuora_account',
    label: 'Zuora Account',
    sections: [
      {
        title: 'Zuora Account',
        fields: [
          { key: 'zuora_account_number', label: 'Zuora Account Number' },
          { key: 'zuora_balance', label: 'Zuora Balance', type: 'number' },
          { key: 'zuora_auto_pay', label: 'Auto Pay', type: 'checkbox' },
        ],
      },
    ],
  },
  {
    key: 'stripe',
    label: 'Stripe',
    sections: [
      {
        title: 'Stripe',
        fields: [
          { key: 'stripe_customer_id', label: 'Stripe Customer ID' },
          { key: 'stripe_payment_method', label: 'Stripe Payment Method' },
          {
            key: 'stripe_currency',
            label: 'Stripe Currency',
            type: 'select',
            options: ['USD', 'EUR', 'GBP'],
          },
        ],
      },
    ],
  },
  {
    key: 'cch_suretax',
    label: 'CCH® SureTax®',
    sections: [
      {
        title: 'CCH® SureTax®',
        fields: [
          { key: 'suretax_customer_number', label: 'SureTax Customer Number' },
          { key: 'tax_exempt', label: 'Tax Exempt', type: 'checkbox' },
          { key: 'exemption_certificate', label: 'Exemption Certificate' },
        ],
      },
    ],
  },
  {
    key: 'e_document',
    label: 'E-Document',
    sections: [
      {
        title: 'E-Document',
        fields: [
          { key: 'edoc_enabled', label: 'E-Document Enabled', type: 'checkbox' },
          { key: 'edoc_format', label: 'E-Document Format', type: 'select', options: ['PDF', 'XML', 'UBL'] },
          { key: 'edoc_email', label: 'E-Document Email', type: 'email' },
        ],
      },
    ],
  },
  {
    key: 'custom',
    label: 'Custom',
    sections: [
      {
        title: 'Custom',
        fields: [
          { key: 'custom_field_1', label: 'Custom Field 1' },
          { key: 'custom_field_2', label: 'Custom Field 2' },
          { key: 'custom_notes', label: 'Custom Notes', type: 'textarea' },
        ],
      },
    ],
  },
  {
    key: 'preferences',
    label: 'Preferences',
    sections: [
      {
        title: 'Preferences',
        fields: [
          {
            key: 'language',
            label: 'Language',
            type: 'select',
            options: ['English', 'Spanish', 'Portuguese', 'French', 'German'],
          },
          { key: 'timezone', label: 'Timezone' },
          {
            key: 'date_format',
            label: 'Date Format',
            type: 'select',
            options: ['MM/DD/YYYY', 'DD/MM/YYYY', 'YYYY-MM-DD'],
          },
          { key: 'receive_newsletter', label: 'Receive Newsletter', type: 'checkbox' },
        ],
      },
    ],
  },
];

// ---- Helpers ----------------------------------------------------------------

/** Every field across header sections and all tabs, flattened. */
export function allProspectFields(): ProspectField[] {
  return [
    ...PRIMARY_SECTIONS.flatMap((s) => s.fields),
    ...TABS.flatMap((t) => t.sections.flatMap((s) => s.fields)),
  ];
}

/** Initial form values derived from each field's defaultValue. */
export function prospectDefaults(): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const f of allProspectFields()) {
    if (f.type === 'checkbox') {
      out[f.key] = f.defaultValue === 'true';
    } else if (f.defaultValue !== undefined) {
      out[f.key] = f.defaultValue;
    }
  }
  return out;
}
