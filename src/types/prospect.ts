// Prospect is the CRM entity stored in the dedicated `prospects` table
// (migration 000004). JSON keys match the snake_case column names so the
// API response can be spread directly into the form field config map.

export interface Prospect {
  id: string;
  owner_user_id?: string;

  // Primary Information
  custom_form: string;
  status: string;
  comments: string;
  customer_id: string;
  customer_id_auto: boolean;
  parent_company: string;
  sfdc_customer_status: string;
  company_name: string;
  zuora_invoice_name: string;
  account_status: string;
  customer_type: string;
  ar_status: string;
  billing_account_name: string;

  // Email | Phone | Address
  email: string;
  phone: string;
  address: string;
  multiple_email_invoices: string;
  alt_phone: string;

  // Classification
  subsidiary: string;
  talkdesk_region: string;
  talkdesk_id_platform: string;
  web_address: string;
  crm_account_owner: string;
  ar_analyst: string;
  crm_csm: string;
  crm_csm_team: string;
  crm_growth_manager: string;
  white_glove: boolean;
  display_product_code: boolean;

  // Sales
  territory: string;
  estimated_budget: number | null;
  budget_approved: boolean;
  sales_readiness: string;
  buying_reason: string;
  buying_time_frame: string;

  // Financial
  credit_limit: number | null;
  payment_terms: string;
  currency: string;
  tax_id: string;

  // Subsidiaries
  primary_subsidiary: string;
  consolidated_balance: number | null;

  // Address tab
  default_billing_address: string;
  default_shipping_address: string;

  // Relationships
  sales_rep: string;
  partner: string;
  primary_contact: string;
  contact_role: string;

  // Communication
  preferred_channel: string;
  email_preference: string;
  unsubscribe_all: boolean;

  // ZAB Subscriptions
  zab_account_id: string;
  subscription_plan: string;
  billing_cycle: string;

  // Zuora Sync Details
  zuora_account_id: string;
  sync_status: string;
  last_synced: string;

  // Zuora Account
  zuora_account_number: string;
  zuora_balance: number | null;
  zuora_auto_pay: boolean;

  // Stripe
  stripe_customer_id: string;
  stripe_payment_method: string;
  stripe_currency: string;

  // CCH SureTax
  suretax_customer_number: string;
  tax_exempt: boolean;
  exemption_certificate: string;

  // E-Document
  edoc_enabled: boolean;
  edoc_format: string;
  edoc_email: string;

  // Custom
  custom_field_1: string;
  custom_field_2: string;
  custom_notes: string;

  // Preferences
  language: string;
  timezone: string;
  date_format: string;
  receive_newsletter: boolean;

  created_at: string;
  updated_at: string;
}
