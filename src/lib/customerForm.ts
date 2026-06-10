export type CustomerField = {
  key: string;
  label: string;
  type?: 'checkbox' | 'textarea' | 'date';
};

export type CustomerSection = {
  title: string;
  fields: CustomerField[];
};

export type CustomerTab = {
  key: string;
  label: string;
  sections: CustomerSection[];
};

export const PRIMARY_SECTIONS: CustomerSection[] = [
  {
    title: 'Primary Information',
    fields: [
      { key: 'company_name',        label: 'Company Name' },
      { key: 'comments',            label: 'Comments',                         type: 'textarea' },
      { key: 'parent_company',      label: 'Parent Company' },
      { key: 'sfdc_customer_status',label: 'SFDC Customer Status' },
      { key: 'zuora_invoice_name',  label: 'Zuora Invoice Name' },
      { key: 'account_status',      label: 'Account Status' },
      { key: 'customer_type',       label: 'Customer Type' },
      { key: 'ar_status',           label: 'AR Status' },
      { key: 'billing_account_name',label: 'Billing Account Name' },
    ],
  },
  {
    title: 'Email | Phone | Address',
    fields: [
      { key: 'email',                        label: 'Email' },
      { key: 'phone',                        label: 'Phone' },
      { key: 'address',                      label: 'Address',                          type: 'textarea' },
      { key: 'multiple_email_for_invoices',  label: 'Multiple Email Addresses for Invoices' },
      { key: 'alt_phone',                    label: 'Alt. Phone' },
    ],
  },
  {
    title: 'Classification',
    fields: [
      { key: 'represents_subsidiary', label: 'Represents Subsidiary' },
      { key: 'talkdesk_region',       label: 'Talkdesk Region' },
      { key: 'talkdesk_id_platform',  label: 'Talkdesk ID Platform' },
      { key: 'subsidiary',            label: 'Subsidiary' },
      { key: 'web_address',           label: 'Web Address' },
      { key: 'crm_csm',              label: 'CRM CSM' },
      { key: 'crm_csm_team',         label: 'CRM CSM Team' },
      { key: 'white_glove',          label: 'White Glove',          type: 'checkbox' },
      { key: 'crm_growth_manager',   label: 'CRM Growth Manager' },
      { key: 'display_product_code', label: 'Display Product Code', type: 'checkbox' },
      { key: 'ar_analyst',           label: 'AR Analyst' },
      { key: 'crm_account_owner',    label: 'CRM Account Owner' },
    ],
  },
];

export const TABS: CustomerTab[] = [
  {
    key: 'sales',
    label: 'Sales',
    sections: [
      {
        title: 'Sales',
        fields: [{ key: 'territory', label: 'Territory' }],
      },
      {
        title: 'Qualification',
        fields: [
          { key: 'estimated_budget', label: 'Estimated Budget' },
          { key: 'buying_reason',    label: 'Buying Reason' },
          { key: 'budget_approved',  label: 'Budget Approved',  type: 'checkbox' },
          { key: 'buying_time_frame',label: 'Buying Time Frame' },
          { key: 'sales_readiness',  label: 'Sales Readiness' },
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
          { key: 'credit_limit',             label: 'Credit Limit' },
          { key: 'payment_terms',            label: 'Payment Terms' },
          { key: 'currency',                 label: 'Currency' },
          { key: 'tax_registration_number',  label: 'Tax Registration Number' },
          { key: 'default_payment_method',   label: 'Default Payment Method' },
          { key: 'ar_account',               label: 'AR Account' },
          { key: 'credit_hold',              label: 'Credit Hold',  type: 'checkbox' },
          { key: 'dunning_procedure',        label: 'Dunning Procedure' },
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
          { key: 'primary_subsidiary',   label: 'Primary Subsidiary' },
          { key: 'secondary_subsidiaries',label: 'Secondary Subsidiaries' },
          { key: 'eliminations_account', label: 'Eliminations Account' },
          { key: 'intercompany_account', label: 'Intercompany Account', type: 'checkbox' },
          { key: 'transfer_price',       label: 'Transfer Price',       type: 'checkbox' },
        ],
      },
    ],
  },
  {
    key: 'address',
    label: 'Address',
    sections: [
      {
        title: 'Billing Address',
        fields: [
          { key: 'billing_addr1',   label: 'Address Line 1' },
          { key: 'billing_addr2',   label: 'Address Line 2' },
          { key: 'billing_city',    label: 'City' },
          { key: 'billing_state',   label: 'State / Province' },
          { key: 'billing_zip',     label: 'Zip / Postal Code' },
          { key: 'billing_country', label: 'Country' },
        ],
      },
      {
        title: 'Shipping Address',
        fields: [
          { key: 'shipping_same_as_billing', label: 'Same as Billing', type: 'checkbox' },
          { key: 'shipping_addr1',           label: 'Address Line 1' },
          { key: 'shipping_addr2',           label: 'Address Line 2' },
          { key: 'shipping_city',            label: 'City' },
          { key: 'shipping_state',           label: 'State / Province' },
          { key: 'shipping_zip',             label: 'Zip / Postal Code' },
          { key: 'shipping_country',         label: 'Country' },
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
          { key: 'account_manager', label: 'Account Manager' },
          { key: 'sales_engineer',  label: 'Sales Engineer' },
          { key: 'partner_account', label: 'Partner Account' },
          { key: 'referred_by',     label: 'Referred By' },
          { key: 'customer_since',  label: 'Customer Since', type: 'date' },
          { key: 'renewal_owner',   label: 'Renewal Owner' },
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
          { key: 'preferred_contact_method', label: 'Preferred Contact Method' },
          { key: 'support_tier',             label: 'Support Tier' },
          { key: 'slack_channel',            label: 'Slack Channel' },
          { key: 'primary_contact_name',     label: 'Primary Contact Name' },
          { key: 'primary_contact_email',    label: 'Primary Contact Email' },
          { key: 'newsletter',               label: 'Newsletter Subscription', type: 'checkbox' },
          { key: 'marketing_emails',         label: 'Marketing Emails',        type: 'checkbox' },
          { key: 'nda_signed',               label: 'NDA Signed',              type: 'checkbox' },
        ],
      },
    ],
  },
  {
    key: 'zab',
    label: 'ZAB Subscriptions',
    sections: [
      {
        title: 'ZAB Subscriptions',
        fields: [
          { key: 'zab_subscription_id',    label: 'Subscription ID' },
          { key: 'zab_plan_name',          label: 'Plan Name' },
          { key: 'zab_mrr',               label: 'MRR' },
          { key: 'zab_contract_start',    label: 'Contract Start Date', type: 'date' },
          { key: 'zab_contract_end',      label: 'Contract End Date',   type: 'date' },
          { key: 'zab_billing_frequency', label: 'Billing Frequency' },
          { key: 'zab_auto_renew',        label: 'Auto Renew',          type: 'checkbox' },
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
          { key: 'zuora_account_id',  label: 'Zuora Account ID' },
          { key: 'zuora_sync_status', label: 'Sync Status' },
          { key: 'zuora_last_sync',   label: 'Last Sync Date',   type: 'date' },
          { key: 'zuora_sync_error',  label: 'Sync Error Message' },
          { key: 'zuora_entity',      label: 'Zuora Entity' },
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
          { key: 'zuora_account_number',    label: 'Account Number' },
          { key: 'zuora_invoice_owner',     label: 'Invoice Owner' },
          { key: 'zuora_payment_method_id', label: 'Payment Method ID' },
          { key: 'zuora_bill_cycle_day',    label: 'Bill Cycle Day' },
          { key: 'zuora_batch',             label: 'Batch' },
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
          { key: 'stripe_customer_id',     label: 'Customer ID' },
          { key: 'stripe_subscription_id', label: 'Subscription ID' },
          { key: 'stripe_status',          label: 'Status' },
          { key: 'stripe_payment_method',  label: 'Payment Method' },
          { key: 'stripe_connect_account', label: 'Connect Account' },
        ],
      },
    ],
  },
  {
    key: 'cch',
    label: 'CCH® SureTax®',
    sections: [
      {
        title: 'CCH® SureTax®',
        fields: [
          { key: 'tax_exempt',              label: 'Tax Exempt',                type: 'checkbox' },
          { key: 'exemption_cert_number',   label: 'Exemption Certificate Number' },
          { key: 'tax_classification',      label: 'Tax Classification' },
          { key: 'nexus_state',             label: 'Nexus State' },
          { key: 'suretax_customer_number', label: 'SureTax Customer Number' },
        ],
      },
    ],
  },
  {
    key: 'edocument',
    label: 'E-Document',
    sections: [
      {
        title: 'E-Document',
        fields: [
          { key: 'einvoice_enabled',    label: 'E-Invoice Enabled',  type: 'checkbox' },
          { key: 'einvoice_format',     label: 'E-Invoice Format' },
          { key: 'edoc_delivery_method',label: 'Delivery Method' },
          { key: 'edoc_contact_email',  label: 'E-Document Contact Email' },
          { key: 'peppol_id',           label: 'Peppol ID' },
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
          { key: 'custom_field_3', label: 'Custom Field 3' },
          { key: 'custom_date',    label: 'Custom Date',    type: 'date' },
          { key: 'custom_notes',   label: 'Custom Notes',   type: 'textarea' },
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
          { key: 'pref_language',        label: 'Language' },
          { key: 'pref_date_format',     label: 'Date Format' },
          { key: 'pref_timezone',        label: 'Timezone' },
          { key: 'pref_currency_display',label: 'Currency Display' },
          { key: 'pref_fiscal_year_start',label: 'Fiscal Year Start' },
        ],
      },
    ],
  },
  {
    key: 'sfdc',
    label: 'SFDC',
    sections: [
      {
        title: 'SFDC',
        fields: [
          { key: 'sfdc_account_id',    label: 'SFDC Account ID' },
          { key: 'sfdc_opportunity_id',label: 'SFDC Opportunity ID' },
          { key: 'sfdc_owner',         label: 'SFDC Owner' },
          { key: 'sfdc_last_sync',     label: 'SFDC Last Sync',      type: 'date' },
          { key: 'sfdc_record_type',   label: 'SFDC Record Type' },
          { key: 'sfdc_sync_enabled',  label: 'SFDC Sync Enabled',   type: 'checkbox' },
        ],
      },
    ],
  },
];
