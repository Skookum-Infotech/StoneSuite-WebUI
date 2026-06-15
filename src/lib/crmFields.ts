import type { CrmLookups } from '@/services/lookupService';

export type CrmCoreFieldType = 'text' | 'email' | 'tel' | 'textarea' | 'lookup-select';

export interface CrmCoreField {
  key: string;
  label: string;
  type: CrmCoreFieldType;
  required?: boolean;
  placeholder?: string;
  /** Key into CrmLookups providing this field's options (lookup-select only). */
  lookupKey?: keyof CrmLookups;
  /** Another core field key whose value filters this field's lookup options (e.g. state_id -> country_id). */
  dependsOn?: string;
}

export interface CrmCoreSection {
  title: string;
  fields: CrmCoreField[];
}

// Unified core-field layout shared by Lead, Prospect, and Customer records.
export const CRM_CORE_SECTIONS: CrmCoreSection[] = [
  {
    title: 'Primary Information',
    fields: [
      { key: 'company_name', label: 'Company Name', type: 'text', required: true, placeholder: 'Acme Corp' },
      { key: 'first_name', label: 'First Name', type: 'text', placeholder: 'Jane' },
      { key: 'last_name', label: 'Last Name', type: 'text', placeholder: 'Doe' },
    ],
  },
  {
    title: 'Contact Details',
    fields: [
      { key: 'email', label: 'Email', type: 'email', required: true, placeholder: 'jane@acme.com' },
      { key: 'phone', label: 'Phone', type: 'tel', placeholder: '+1 (555) 123-4567' },
      { key: 'address', label: 'Address', type: 'textarea' },
      { key: 'contact_method_id', label: 'Preferred Contact Method', type: 'lookup-select', lookupKey: 'contactMethods' },
      { key: 'lead_source_id', label: 'Lead Source', type: 'lookup-select', lookupKey: 'leadSources' },
    ],
  },
  {
    title: 'Classification & Terms',
    fields: [
      { key: 'customer_type_id', label: 'Customer Type', type: 'lookup-select', lookupKey: 'customerTypes' },
      { key: 'currency_id', label: 'Currency', type: 'lookup-select', lookupKey: 'currencies' },
      { key: 'country_id', label: 'Country', type: 'lookup-select', lookupKey: 'countries' },
      { key: 'state_id', label: 'State / Province', type: 'lookup-select', lookupKey: 'states', dependsOn: 'country_id' },
      { key: 'payment_terms_id', label: 'Payment Terms', type: 'lookup-select', lookupKey: 'paymentTerms' },
      { key: 'ar_status_id', label: 'AR Status', type: 'lookup-select', lookupKey: 'arStatuses' },
    ],
  },
];

/** Default (empty) values for every key declared in CRM_CORE_SECTIONS. */
export function crmCoreDefaults(): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const section of CRM_CORE_SECTIONS) {
    for (const field of section.fields) {
      defaults[field.key] = '';
    }
  }
  return defaults;
}
