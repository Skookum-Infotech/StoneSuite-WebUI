export type LeadFieldType =
  | 'text'
  | 'textarea'
  | 'select'
  | 'checkbox'
  | 'email'
  | 'tel'
  | 'number'
  | 'type_toggle';

export interface LeadField {
  key: string;
  label: string;
  type?: LeadFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
  readOnly?: boolean;
  defaultValue?: string;
  showWhen?: { key: string; value: string };
}

export interface LeadSection {
  title: string;
  fields: LeadField[];
}

export interface LeadTab {
  key: string;
  label: string;
  sections: LeadSection[];
}

export const PRIMARY_SECTIONS: LeadSection[] = [
  {
    title: 'Primary Information',
    fields: [
      {
        key: 'custom_form',
        label: 'Custom Form',
        type: 'select',
        options: ['Standard Lead Form'],
        defaultValue: 'Standard Lead Form',
      },
      {
        key: 'type',
        label: 'Type',
        type: 'type_toggle',
        required: true,
        options: ['Company', 'Individual'],
        defaultValue: 'Company',
      },
      { key: 'company_name', label: 'Company Name', required: true, showWhen: { key: 'type', value: 'Company' } },
      { key: 'first_name', label: 'First Name', required: true, showWhen: { key: 'type', value: 'Individual' } },
      { key: 'last_name', label: 'Last Name', showWhen: { key: 'type', value: 'Individual' } },
      { key: 'default_order_priority', label: 'Default Order Priority' },
      {
        key: 'sales_rep',
        label: 'Sales Rep',
        type: 'select',
        options: ['', 'Alex Johnson', 'Maria Garcia', 'James Lee', 'Sarah Chen', 'David Kim'],
      },
      {
        key: 'territory',
        label: 'Territory',
        type: 'select',
        options: ['', 'North America – East', 'North America – West', 'EMEA', 'APAC', 'LATAM', 'Global'],
      },
      {
        key: 'partner',
        label: 'Partner',
        type: 'select',
        options: ['', 'Accenture', 'Deloitte Digital', 'KPMG', 'PwC', 'Salesforce Partner Network', 'None'],
      },
    ],
  },
  {
    title: 'Email | Phone | Address',
    fields: [
      { key: 'email', label: 'Email', type: 'email' },
      { key: 'phone', label: 'Phone', type: 'tel' },
      { key: 'fax', label: 'Fax' },
      { key: 'address', label: 'Address', type: 'textarea' },
    ],
  },
  {
    title: 'Classification',
    fields: [
      {
        key: 'primary_subsidiary',
        label: 'Primary Subsidiary',
        type: 'select',
        required: true,
        options: ['', 'Talkdesk Inc.', 'Talkdesk UK Ltd.', 'Talkdesk Portugal', 'Talkdesk Germany GmbH', 'Talkdesk Australia Pty Ltd.'],
      },
      { key: 'email_for_payment_notification', label: 'Email for Payment Notification', type: 'email' },
      { key: 'sfdc_account_id', label: 'SFDC Account ID' },
      {
        key: 'sfdc_customer_status',
        label: 'SFDC Customer Status',
        type: 'select',
        options: ['', 'Active', 'Inactive', 'On Hold', 'Churned', 'Prospect', 'Trial'],
      },
      { key: 'crm_account_owner', label: 'CRM Account Owner' },
      { key: 'prev_external_id', label: 'Prev External ID' },
      {
        key: 'customer_type',
        label: 'Customer Type',
        type: 'select',
        options: ['Customer', 'Prospect', 'Partner'],
        defaultValue: 'Customer',
      },
      { key: 'crm_csm_team', label: 'CRM CSM Team' },
      { key: 'customer_legal_name', label: 'Customer Legal Name' },
      { key: 'additional_emails', label: 'Additional Emails' },
      { key: 'crm_csm', label: 'CRM CSM' },
      { key: 'sfdc_external_id', label: 'SFDC External ID' },
      { key: 'talkdesk_region', label: 'Talkdesk Region' },
      { key: 'crm_growth_manager', label: 'CRM Growth Manager' },
      { key: 'talkdesk_id_platform', label: 'Talkdesk ID Platform' },
      { key: 'zuora_invoice_name', label: 'Zuora Invoice Name' },
      { key: 'white_glove', label: 'White Glove', type: 'checkbox' },
      { key: 'display_product_code', label: 'Display Product Code', type: 'checkbox' },
      { key: 'blackline_ar_cash_app', label: 'Blackline AR Cash App', type: 'checkbox' },
    ],
  },
];

export const TABS: LeadTab[] = [
  { key: 'subsidiaries', label: 'Subsidiaries', sections: [] },
  {
    key: 'qualification',
    label: 'Qualification',
    sections: [
      {
        title: 'Qualification',
        fields: [
          { key: 'estimated_budget', label: 'Estimated Budget', type: 'number', placeholder: 'e.g. 50000' },
          {
            key: 'buying_reason',
            label: 'Buying Reason',
            type: 'select',
            options: ['', 'Cost Savings', 'Efficiency', 'Compliance', 'Growth'],
          },
          { key: 'budget_approved', label: 'Budget Approved', type: 'checkbox' },
          {
            key: 'buying_time_frame',
            label: 'Buying Time Frame',
            type: 'select',
            options: ['', '0–3 months', '3–6 months', '6–12 months', '12+ months'],
          },
          {
            key: 'sales_readiness',
            label: 'Sales Readiness',
            type: 'select',
            options: ['', 'Early Stage', 'Mid Stage', 'Late Stage', 'Ready to Buy'],
          },
        ],
      },
    ],
  },
  { key: 'communication', label: 'Communication', sections: [] },
  { key: 'address', label: 'Address', sections: [] },
  { key: 'marketing', label: 'Marketing', sections: [] },
  { key: 'preferences', label: 'Preferences', sections: [] },
  { key: 'system_information', label: 'System Information', sections: [] },
  { key: 'custom', label: 'Custom', sections: [] },
  { key: 'e_document', label: 'E-Document', sections: [] },
];

export function allLeadFields(): LeadField[] {
  return [
    ...PRIMARY_SECTIONS.flatMap((s) => s.fields),
    ...TABS.flatMap((t) => t.sections.flatMap((s) => s.fields)),
  ];
}

export function leadDefaults(): Record<string, unknown> {
  const out: Record<string, unknown> = { type: 'Company' };
  for (const f of allLeadFields()) {
    if (f.type === 'checkbox') {
      out[f.key] = f.defaultValue === 'true';
    } else if (f.defaultValue !== undefined) {
      out[f.key] = f.defaultValue;
    }
  }
  return out;
}
