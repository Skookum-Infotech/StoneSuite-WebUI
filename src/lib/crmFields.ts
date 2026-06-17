import type { CrmLookups } from '@/services/lookupService';

export type CrmCoreFieldType =
  | 'text'
  | 'email'
  | 'tel'
  | 'textarea'
  | 'address'
  | 'lookup-select'
  | 'date'
  | 'number'
  | 'checkbox'
  | 'readonly';

export interface CrmCoreField {
  key: string;
  label: string;
  type: CrmCoreFieldType;
  required?: boolean;
  placeholder?: string;
  /** Key into CrmLookups providing this field's options (lookup-select only). */
  lookupKey?: keyof CrmLookups;
  /** Another core field key whose value filters this field's lookup options (e.g. state -> country). */
  dependsOn?: string;
  /** Hide this field when the named checkbox field is checked (truthy). */
  showIfFieldFalse?: string;
  /** Show this field only when the named checkbox field is checked (truthy). */
  showIfFieldTrue?: string;
}

export interface CrmCoreSection {
  title: string;
  fields: CrmCoreField[];
}

// Shared by Lead, Prospect, and Customer records — derived from the Customer sheet.
export const CRM_CORE_SECTIONS: CrmCoreSection[] = [
  {
    title: 'Primary Information',
    fields: [
      { key: 'customer_doc_num', label: 'Record #', type: 'readonly' },
      { key: 'customer_name', label: 'Customer Name', type: 'text', required: true, placeholder: 'Acme Corp' },
      { key: 'customer_dba_name', label: 'Customer DBA Name', type: 'text' },
      { key: 'customer_tax_id', label: 'EIN / TAN / GSTIN ID', type: 'text' },
      { key: 'customer_type', label: 'Customer Type', type: 'lookup-select', lookupKey: 'customerTypes' },
      { key: 'customer_authorized_person_fname', label: 'Authorized Person First Name', type: 'text' },
      { key: 'customer_authorized_person_lname', label: 'Authorized Person Last Name', type: 'text' },
      { key: 'customer_is_child', label: 'Is Child Customer', type: 'checkbox' },
      { key: 'customer_parent_company', label: 'Parent Customer', type: 'lookup-select', lookupKey: 'parentCustomers', showIfFieldTrue: 'customer_is_child' },
      { key: 'customer_ar_status', label: 'AR Status', type: 'lookup-select', lookupKey: 'arStatuses' },
    ],
  },
  {
    title: 'Contact Information',
    fields: [
      { key: 'customer_primary_phonenum', label: 'Primary Phone', type: 'tel', placeholder: '+1 (555) 123-4567' },
      { key: 'customer_alt_phonenum', label: 'Alternate Phone', type: 'tel' },
      { key: 'customer_faxnum', label: 'Fax', type: 'tel' },
      { key: 'customer_cmpny_website', label: 'Website', type: 'text', placeholder: 'https://acme.com' },
      { key: 'customer_contact_email', label: 'Contact Email', type: 'email', required: true, placeholder: 'contact@acme.com' },
      { key: 'customer_accounts_email', label: 'Accounting Email', type: 'email' },
      { key: 'customer_addl_email', label: 'Additional Email', type: 'email' },
      { key: 'customer_addr_line1', label: 'Address Line 1', type: 'address' },
      { key: 'customer_addr_line2', label: 'Address Line 2', type: 'address' },
      { key: 'customer_addr_suitenum', label: 'Suite / Unit #', type: 'text' },
      { key: 'customer_addr_city', label: 'City', type: 'text' },
      { key: 'customer_addr_country', label: 'Country', type: 'lookup-select', lookupKey: 'countries' },
      { key: 'customer_addr_state', label: 'State / Province', type: 'lookup-select', lookupKey: 'states', dependsOn: 'customer_addr_country' },
      { key: 'customer_addr_zip', label: 'Zip / Postal Code', type: 'text' },
    ],
  },
  {
    title: 'Billing Address',
    fields: [
      { key: 'customer_is_bill_as_primary', label: 'Billing Same as Primary', type: 'checkbox' },
      { key: 'customer_bill_addr_line1', label: 'Address Line 1', type: 'address', showIfFieldFalse: 'customer_is_bill_as_primary' },
      { key: 'customer_bill_addr_line2', label: 'Address Line 2', type: 'address', showIfFieldFalse: 'customer_is_bill_as_primary' },
      { key: 'customer_bill_addr_suitenum', label: 'Suite / Unit #', type: 'text', showIfFieldFalse: 'customer_is_bill_as_primary' },
      { key: 'customer_bill_addr_city', label: 'City', type: 'text', showIfFieldFalse: 'customer_is_bill_as_primary' },
      { key: 'customer_bill_addr_country', label: 'Country', type: 'lookup-select', lookupKey: 'countries', showIfFieldFalse: 'customer_is_bill_as_primary' },
      { key: 'customer_bill_addr_state', label: 'State / Province', type: 'lookup-select', lookupKey: 'states', dependsOn: 'customer_bill_addr_country', showIfFieldFalse: 'customer_is_bill_as_primary' },
      { key: 'customer_bill_addr_zip', label: 'Zip / Postal Code', type: 'text', showIfFieldFalse: 'customer_is_bill_as_primary' },
    ],
  },
  {
    title: 'Shipping Address',
    fields: [
      { key: 'customer_is_ship_as_primary', label: 'Shipping Same as Primary', type: 'checkbox' },
      { key: 'customer_ship_addr_line1', label: 'Address Line 1', type: 'address', showIfFieldFalse: 'customer_is_ship_as_primary' },
      { key: 'customer_ship_addr_line2', label: 'Address Line 2', type: 'address', showIfFieldFalse: 'customer_is_ship_as_primary' },
      { key: 'customer_ship_addr_suitenum', label: 'Suite / Unit #', type: 'text', showIfFieldFalse: 'customer_is_ship_as_primary' },
      { key: 'customer_ship_addr_city', label: 'City', type: 'text', showIfFieldFalse: 'customer_is_ship_as_primary' },
      { key: 'customer_ship_addr_country', label: 'Country', type: 'lookup-select', lookupKey: 'countries', showIfFieldFalse: 'customer_is_ship_as_primary' },
      { key: 'customer_ship_addr_state', label: 'State / Province', type: 'lookup-select', lookupKey: 'states', dependsOn: 'customer_ship_addr_country', showIfFieldFalse: 'customer_is_ship_as_primary' },
      { key: 'customer_ship_addr_zip', label: 'Zip / Postal Code', type: 'text', showIfFieldFalse: 'customer_is_ship_as_primary' },
    ],
  },
  {
    title: 'CRM Fields',
    fields: [
      { key: 'customer_lead_source', label: 'Lead Source', type: 'lookup-select', lookupKey: 'leadSources' },
      { key: 'customer_lead_score', label: 'Lead Score', type: 'number' },
      { key: 'customer_expected_close_date', label: 'Expected Close Date', type: 'date' },
      { key: 'customer_expected_deal_value', label: 'Estimated Deal Value', type: 'number' },
      { key: 'customer_last_contacted_date', label: 'Last Contact Date', type: 'date' },
      { key: 'customer_preferred_contact_method', label: 'Preferred Contact Method', type: 'lookup-select', lookupKey: 'contactMethods' },
      { key: 'customer_do_not_contact', label: 'Is Do Not Contact', type: 'checkbox' },
      { key: 'customer_internal_notes', label: 'Internal Notes', type: 'textarea' },
    ],
  },
  {
    title: 'Sales Fields',
    fields: [
      { key: 'customer_sales_rep', label: 'Sales Rep', type: 'lookup-select', lookupKey: 'employees' },
      { key: 'customer_price_level', label: 'Price Level', type: 'lookup-select', lookupKey: 'priceLevels' },
      { key: 'customer_is_tax_exempt', label: 'Tax Exempt', type: 'checkbox' },
      { key: 'customer_tax_exempt_reason', label: 'Tax Exempt Reason', type: 'textarea', showIfFieldTrue: 'customer_is_tax_exempt' },
      { key: 'customer_tax_exempt_cert_num', label: 'Tax Exempt Certificate #', type: 'text', showIfFieldTrue: 'customer_is_tax_exempt' },
      { key: 'customer_tax_exempt_cert_file_id', label: 'Tax Exempt Certificate File', type: 'text', showIfFieldTrue: 'customer_is_tax_exempt' },
      { key: 'customer_tax_exempt_expiry_date', label: 'Tax Exempt Expiry Date', type: 'date', showIfFieldTrue: 'customer_is_tax_exempt' },
      { key: 'customer_sales_tax_percent', label: 'Sales Tax %', type: 'number' },
      { key: 'customer_payment_terms', label: 'Payment Terms', type: 'lookup-select', lookupKey: 'paymentTerms' },
    ],
  },
  {
    title: 'Credit Fields',
    fields: [
      { key: 'customer_credit_limit', label: 'Credit Limit', type: 'number' },
      { key: 'customer_is_credit_lock', label: 'Credit Lock', type: 'checkbox' },
      { key: 'customer_credit_lock_reason', label: 'Credit Lock Reason', type: 'textarea', showIfFieldTrue: 'customer_is_credit_lock' },
    ],
  },
];

/** Customer-only section shown in Edit/Detail views — computed balance values. */
export const CRM_CUSTOMER_BALANCE_SECTION: CrmCoreSection = {
  title: 'Customer Balances',
  fields: [
    { key: 'customer_total_balance', label: 'Balance', type: 'readonly' },
    { key: 'customer_deposit_balance', label: 'Deposit Balance', type: 'readonly' },
    { key: 'customer_overdue_balance', label: 'Overdue Balance', type: 'readonly' },
    { key: 'customer_days_overdue', label: 'Days Overdue', type: 'readonly' },
    { key: 'customer_currency', label: 'Currency', type: 'lookup-select', lookupKey: 'currencies' },
  ],
};

/** Sub-tab definitions shown post-creation on Customer records only. */
export const CRM_CUSTOMER_SUB_TABS = [
  { key: 'transactions', label: 'Transactions' },
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;

/** Sub-tab definitions shown post-creation on Lead and Prospect records. */
export const CRM_LEAD_PROSPECT_SUB_TABS = [
  { key: 'audit', label: 'Audit' },
  { key: 'files', label: 'Files' },
] as const;

export type CrmCustomerSubTab = (typeof CRM_CUSTOMER_SUB_TABS)[number]['key'];
export type CrmLeadProspectSubTab = (typeof CRM_LEAD_PROSPECT_SUB_TABS)[number]['key'];

/** Default (empty) values for every key declared in CRM_CORE_SECTIONS. */
export function crmCoreDefaults(): Record<string, unknown> {
  const defaults: Record<string, unknown> = {};
  for (const section of CRM_CORE_SECTIONS) {
    for (const field of section.fields) {
      defaults[field.key] = field.type === 'checkbox' ? false : '';
    }
  }
  return defaults;
}
