import type { ElementType } from 'react';
import { Building2, MapPin, Truck, RotateCcw, ShieldCheck, Banknote, Warehouse } from 'lucide-react';

// The onboarding form's field spec -- kept apart from OnboardingForm.tsx so
// the required-field rules are a pure, unit-testable function of the data
// (see missingRequiredLabels) rather than something only a rendered form can
// answer.

// 'full' spans both columns inside a section card; default = 1 column.
// 'country'/'state'/'currency' render as OnboardingSelectField
// (lookup-table-backed dropdowns) instead of a plain input.
export type BaseField = {
  key: string;
  label: string;
  required?: boolean;
  type?: 'tel' | 'email' | 'url' | 'country' | 'state' | 'currency';
  full?: boolean;
  placeholder?: string;
  // On a 'country' field: the sibling state field to clear when the country
  // changes, since a state only makes sense within its own country.
  stateKey?: string;
  // On a 'state' field: the sibling country field whose value narrows this
  // dropdown to that country's states.
  countryKey?: string;
};

export interface FormSection {
  title: string;
  icon: ElementType;
  fields: BaseField[];
}

// Flat-key prefix of the applicant's primary location's address. The backend
// reads the same keys back (companylocation.OnboardingKeyPrefix) to seed the
// tenant's first Company Info location.
export const LOCATION_ADDRESS_PREFIX = 'location_address';

// Address parts a section can mark mandatory when it passes requireCore.
const CORE_ADDRESS_PARTS: ReadonlySet<string> = new Set(['line1', 'city', 'country', 'state', 'zip']);

// Same line1/line2/suite/city/country/state/zip shape as a CRM record's own
// address fields (lib/crmFields.ts) and the tenant's own Company Info page
// (CompanyProfilePage.tsx) — structured, not one free-text blob. Submitted
// as flat prefix_line1/prefix_city/etc. keys (see OnboardingFormData),
// matching what onboardingseed's metadata parsers read back.
// Placeholders mirror CompanyProfileTab.tsx's ADDRESS_SUBFIELDS exactly,
// since both forms feed the same company_profile columns.
function addressFields(prefix: string, requireCore = false): BaseField[] {
  const required = (part: string) => requireCore && CORE_ADDRESS_PARTS.has(part);
  return [
    { key: `${prefix}_line1`, label: 'Address Line 1', required: required('line1'), full: true, placeholder: 'e.g. 123 Main Street' },
    { key: `${prefix}_line2`, label: 'Address Line 2', placeholder: 'e.g. Building B' },
    { key: `${prefix}_suite`, label: 'Suite / Unit #', placeholder: 'e.g. Suite 400' },
    { key: `${prefix}_city`, label: 'City', required: required('city'), placeholder: 'e.g. Springfield' },
    {
      key: `${prefix}_country`, label: 'Country', required: required('country'), type: 'country',
      stateKey: `${prefix}_state`, placeholder: 'Select a country',
    },
    {
      key: `${prefix}_state`, label: 'State / Province', required: required('state'), type: 'state',
      countryKey: `${prefix}_country`, placeholder: 'Select a state',
    },
    { key: `${prefix}_zip`, label: 'Zip / Postal Code', required: required('zip'), placeholder: 'e.g. 62704' },
  ];
}

export const SECTIONS: FormSection[] = [
  {
    title: 'Company Information',
    icon: Building2,
    // Placeholders for the fields shared with CompanyProfileTab.tsx's
    // COMPANY_FIELDS mirror its wording exactly.
    fields: [
      { key: 'company_name', label: 'Company Name', required: true, full: true, placeholder: 'e.g. Acme Stone Co.' },
      { key: 'legal_name',   label: 'Legal Name', placeholder: 'e.g. Acme Stone Company LLC' },
      { key: 'industry',     label: 'Industry', placeholder: 'e.g. Stone Fabrication' },
      { key: 'website',      label: 'Website',    type: 'url', placeholder: 'e.g. https://acmestone.com' },
      { key: 'country',      label: 'Country', required: true, type: 'country', placeholder: 'Select a country' },
      { key: 'currency',     label: 'Currency', required: true, type: 'currency', placeholder: 'Select a currency' },
      { key: 'timezone',     label: 'Timezone', placeholder: 'e.g. America/Chicago' },
      { key: 'tax_id',       label: 'Tax / VAT ID', placeholder: 'e.g. 12-3456789' },
    ],
  },
  {
    // Becomes the tenant's first, default Company Info location. Name plus the
    // street/city/country/state/zip are mandatory; phone, line 2 and suite
    // stay optional.
    title: 'Primary Location',
    icon: Warehouse,
    fields: [
      { key: 'location_name',  label: 'Location Name', required: true, placeholder: 'e.g. Main Showroom' },
      { key: 'location_phone', label: 'Phone', type: 'tel', placeholder: 'e.g. (555) 123-4567' },
      ...addressFields(LOCATION_ADDRESS_PREFIX, true),
    ],
  },
  { title: 'Billing Address', icon: MapPin, fields: addressFields('billing_address') },
  { title: 'Shipping Address', icon: Truck, fields: addressFields('shipping_address') },
  { title: 'Return Address', icon: RotateCcw, fields: addressFields('return_address') },
  {
    title: 'Super Admin Contact',
    icon: ShieldCheck,
    fields: [
      { key: 'super_admin_name',      label: 'Full Name', placeholder: 'e.g. Jordan Lee' },
      { key: 'super_admin_email',     label: 'Email',     required: true, type: 'email', placeholder: 'e.g. jordan@acmestone.com' },
      { key: 'super_admin_phone',     label: 'Phone',     type: 'tel', placeholder: 'e.g. (555) 123-4567' },
      { key: 'super_admin_job_title', label: 'Job Title', placeholder: 'e.g. Owner' },
    ],
  },
  {
    title: 'Finance Contact',
    icon: Banknote,
    fields: [
      { key: 'finance_name',  label: 'Name', placeholder: 'e.g. Taylor Brooks' },
      { key: 'finance_email', label: 'Email', type: 'email', placeholder: 'e.g. billing@acmestone.com' },
      { key: 'finance_phone', label: 'Phone', type: 'tel', placeholder: 'e.g. (555) 123-4567' },
    ],
  },
];

export const BASE_KEYS: ReadonlySet<string> = new Set(SECTIONS.flatMap((s) => s.fields.map((f) => f.key)));
export const ALL_BASE_FIELDS: BaseField[] = SECTIONS.flatMap((s) => s.fields);

// Section-qualified labels ("Primary Location: State / Province") because
// Country/Phone/Email repeat across sections and would be ambiguous alone.
const REQUIRED_FIELDS = SECTIONS.flatMap((s) =>
  s.fields.filter((f) => f.required).map((f) => ({ key: f.key, label: `${s.title}: ${f.label}` })),
);

// Labels of every required field that is blank in `values`, in form order. The
// dropdown fields aren't native inputs, so the browser's own `required`
// validation can't cover them -- this is the check that does.
export function missingRequiredLabels(values: Record<string, unknown>): string[] {
  return REQUIRED_FIELDS
    .filter(({ key }) => {
      const v = values[key];
      return typeof v !== 'string' || v.trim() === '';
    })
    .map(({ label }) => label);
}
