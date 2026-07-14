// Vendor form field definitions — Schema.org Person/Organization mapping.
// Mirrors the declarative field-def + mapper pattern used by `salesOrderForm.ts`:
// UI-facing keys stay flat in form state (Record<string, unknown>) and are
// assembled into the wire payload only at submit time via toCreatePayload.

import type { CrmLookups } from '@/services/lookupService';
import type {
  AcceptedPaymentMethod, Vendor, VendorCreatePayload, VendorType,
} from '@/types/vendor';

export interface VendorFormField {
  key: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'email' | 'tel' | 'url' | 'number' | 'date';
  required?: boolean;
  options?: string[];
  /** Options sourced from CrmLookups[lookupKey] (id/name pairs) — value stored
   *  is the row's numeric id (as a string), e.g. nationality/country. */
  lookupKey?: keyof CrmLookups;
  placeholder?: string;
  colSpan2?: boolean;
  colSpanFull?: boolean;
  rows?: number;
}

export const HONORIFIC_PREFIX_OPTIONS = ['Mr', 'Mrs', 'Ms', 'Dr', 'Prof'];
export const GENDER_OPTIONS = ['Male', 'Female', 'Non-binary', 'Prefer not to say', 'Other'];

// ── Shared fields (always visible) ───────────────────────────────────────────

export const VENDOR_CONTACT_FIELDS: VendorFormField[] = [
  { key: 'email', label: 'Email Address', type: 'email', placeholder: 'vendor@company.com' },
  { key: 'fax_number', label: 'Fax Number', type: 'tel', placeholder: '+1 (555) 000-0000' },
  {
    key: 'physical_address', label: 'Physical Address', type: 'textarea', rows: 3,
    colSpanFull: true, placeholder: '123 Main Street, Suite 100, City, State, Zip',
  },
];

export const VENDOR_CONTACT_POINT_FIELDS: VendorFormField[] = [
  { key: 'contact_point_type', label: 'Contact Type', type: 'text', placeholder: 'e.g. Sales, Support' },
  { key: 'contact_point_telephone', label: 'Contact Telephone', type: 'tel', placeholder: '+1 (555) 000-0000' },
  { key: 'contact_point_email', label: 'Contact Email', type: 'email', placeholder: 'contact@company.com' },
];

export const VENDOR_IDENTIFIER_FIELDS: VendorFormField[] = [
  { key: 'global_location_number', label: 'Global Location Number (GLN)', type: 'text', placeholder: '0614141000005' },
  { key: 'isic_v4_code', label: 'ISIC V4 Code', type: 'text', placeholder: 'e.g. 4649' },
];

export const VENDOR_RECOGNITION_FIELDS: VendorFormField[] = [
  { key: 'awards_won', label: 'Awards Won', type: 'text', placeholder: 'e.g. Best Supplier 2025' },
];

export const VENDOR_COMMERCE_FIELDS: VendorFormField[] = [
  { key: 'funder', label: 'Funding / Funder Information', type: 'text', placeholder: 'e.g. Series B — Acme Capital' },
  { key: 'has_offer_catalog_url', label: 'Offer Catalog Link', type: 'url', placeholder: 'https://company.com/catalog' },
  { key: 'point_of_sale_locations', label: 'Point of Sale (POS) Locations', type: 'text', placeholder: 'e.g. Store #12, Store #45' },
];

// ── Person fields (vendorType === 'Person') ──────────────────────────────────

export const VENDOR_PERSON_IDENTITY_FIELDS: VendorFormField[] = [
  { key: 'honorific_prefix', label: 'Honorific Prefix', type: 'select', options: HONORIFIC_PREFIX_OPTIONS },
  { key: 'given_name', label: 'First Name', type: 'text', required: true, placeholder: 'Jane' },
  { key: 'additional_name', label: 'Middle Name', type: 'text', placeholder: 'Marie' },
  { key: 'family_name', label: 'Last Name', type: 'text', required: true, placeholder: 'Doe' },
  { key: 'honorific_suffix', label: 'Honorific Suffix', type: 'text', placeholder: 'e.g. PhD, MD' },
  { key: 'job_title', label: 'Job Title', type: 'text', placeholder: 'e.g. Procurement Manager' },
];

export const VENDOR_PERSON_DETAIL_FIELDS: VendorFormField[] = [
  { key: 'gender', label: 'Gender', type: 'select', options: GENDER_OPTIONS },
  { key: 'nationality_country_id', label: 'Nationality', type: 'select', lookupKey: 'countries' },
  { key: 'height', label: 'Personal Height', type: 'text', placeholder: 'e.g. 5\'10"' },
  { key: 'net_worth', label: 'Net Worth', type: 'text', placeholder: 'e.g. $250,000' },
];

// ── Organization fields (vendorType === 'Organization') ──────────────────────

export const VENDOR_ORG_IDENTITY_FIELDS: VendorFormField[] = [
  { key: 'legal_name', label: 'Legal Business Name', type: 'text', required: true, colSpan2: true, placeholder: 'Acme Stone Supply, LLC' },
  {
    key: 'registration_info', label: 'Company Registration Info / Certification', type: 'textarea',
    rows: 3, colSpanFull: true, placeholder: 'Registration number, issuing authority, certifications…',
  },
  { key: 'duns_number', label: 'DUNS Number', type: 'text', placeholder: '9-digit D-U-N-S number' },
  { key: 'department', label: 'Department / Sub-organization', type: 'text', placeholder: 'e.g. West Coast Branch' },
];

export const VENDOR_ORG_LIFECYCLE_FIELDS: VendorFormField[] = [
  { key: 'founding_date', label: 'Founding Date', type: 'date' },
  { key: 'founding_location', label: 'Founding Location', type: 'text', placeholder: 'City, Country' },
  { key: 'dissolution_date', label: 'Dissolution Date', type: 'date' },
];

export const VENDOR_COMPLIANCE_FIELDS: VendorFormField[] = [
  { key: 'ethics_policy_url', label: 'Ethics Policy', type: 'url', placeholder: 'https://company.com/ethics-policy' },
  { key: 'diversity_policy_url', label: 'Diversity Policy', type: 'url', placeholder: 'https://company.com/diversity-policy' },
  { key: 'corrections_policy_url', label: 'Corrections Policy', type: 'url', placeholder: 'https://company.com/corrections-policy' },
  { key: 'actionable_feedback_policy_url', label: 'Actionable Feedback Policy', type: 'url', placeholder: 'https://company.com/feedback-policy' },
];

// ── Form defaults ─────────────────────────────────────────────────────────────

export function vendorDefaults(): Record<string, unknown> {
  return {
    vendor_type: 'Organization' as VendorType,
    associated_brands: [] as string[],
    accepted_payment_methods: [] as AcceptedPaymentMethod[],
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

export interface VendorFieldError {
  key: string;
  label: string;
}

export function validateVendorForm(data: Record<string, unknown>): VendorFieldError[] {
  const errors: VendorFieldError[] = [];
  const vendorType = data.vendor_type as VendorType;

  if (vendorType === 'Person') {
    if (!String(data.given_name ?? '').trim()) errors.push({ key: 'given_name', label: 'First Name' });
    if (!String(data.family_name ?? '').trim()) errors.push({ key: 'family_name', label: 'Last Name' });
  } else {
    if (!String(data.legal_name ?? '').trim()) errors.push({ key: 'legal_name', label: 'Legal Business Name' });
  }
  return errors;
}

// ── Payload mapping (UI form state -> create contract) ───────────────────────

function toStr(v: unknown): string {
  return v === null || v === undefined ? '' : String(v);
}

function toStrOrUndefined(v: unknown): string | undefined {
  const s = toStr(v).trim();
  return s || undefined;
}

function toIntOrNull(v: unknown): number | null {
  const s = toStr(v).trim();
  if (!s) return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

export function toCreatePayload(data: Record<string, unknown>): VendorCreatePayload {
  const vendorType = (data.vendor_type as VendorType) ?? 'Organization';
  const associatedBrands = Array.isArray(data.associated_brands) ? (data.associated_brands as string[]) : [];

  const contactPoint = {
    contactType: toStrOrUndefined(data.contact_point_type),
    telephone: toStrOrUndefined(data.contact_point_telephone),
    email: toStrOrUndefined(data.contact_point_email),
  };
  const hasContactPoint = Boolean(contactPoint.contactType || contactPoint.telephone || contactPoint.email);

  const payload: VendorCreatePayload = {
    vendorType,
    email: toStrOrUndefined(data.email),
    physicalAddress: toStrOrUndefined(data.physical_address),
    faxNumber: toStrOrUndefined(data.fax_number),
    globalLocationNumber: toStrOrUndefined(data.global_location_number),
    isicV4Code: toStrOrUndefined(data.isic_v4_code),
    associatedBrands,
    awardsWon: toStrOrUndefined(data.awards_won),
    contactPoint: hasContactPoint ? contactPoint : undefined,
    funder: toStrOrUndefined(data.funder),
    hasOfferCatalogUrl: toStrOrUndefined(data.has_offer_catalog_url),
    pointOfSaleLocations: toStrOrUndefined(data.point_of_sale_locations),
  };

  if (vendorType === 'Person') {
    payload.honorificPrefix = toStrOrUndefined(data.honorific_prefix);
    payload.givenName = toStr(data.given_name).trim();
    payload.additionalName = toStrOrUndefined(data.additional_name);
    payload.familyName = toStr(data.family_name).trim();
    payload.honorificSuffix = toStrOrUndefined(data.honorific_suffix);
    payload.jobTitle = toStrOrUndefined(data.job_title);
    payload.gender = toStrOrUndefined(data.gender);
    payload.nationalityCountryId = toIntOrNull(data.nationality_country_id);
    payload.height = toStrOrUndefined(data.height);
    payload.netWorth = toStrOrUndefined(data.net_worth);
  } else {
    const acceptedPaymentMethods = Array.isArray(data.accepted_payment_methods)
      ? (data.accepted_payment_methods as AcceptedPaymentMethod[])
      : [];
    const compliancePolicies = {
      ethicsPolicyUrl: toStrOrUndefined(data.ethics_policy_url),
      diversityPolicyUrl: toStrOrUndefined(data.diversity_policy_url),
      correctionsPolicyUrl: toStrOrUndefined(data.corrections_policy_url),
      actionableFeedbackPolicyUrl: toStrOrUndefined(data.actionable_feedback_policy_url),
    };
    const hasCompliancePolicies = Object.values(compliancePolicies).some(Boolean);

    payload.legalName = toStr(data.legal_name).trim();
    payload.registrationInfo = toStrOrUndefined(data.registration_info);
    payload.dunsNumber = toStrOrUndefined(data.duns_number);
    payload.foundingDate = toStrOrUndefined(data.founding_date);
    payload.foundingLocation = toStrOrUndefined(data.founding_location);
    payload.dissolutionDate = toStrOrUndefined(data.dissolution_date);
    payload.department = toStrOrUndefined(data.department);
    payload.acceptedPaymentMethods = acceptedPaymentMethods.length ? acceptedPaymentMethods : undefined;
    payload.compliancePolicies = hasCompliancePolicies ? compliancePolicies : undefined;
  }

  return payload;
}

// ── Inverse mapping (loaded Vendor -> UI form state) ──────────────────────────
// Mirrors fromOrder() in salesOrderForm.ts — seeds EditVendorPage's local form
// state from the record returned by vendorService.getVendor.

export function fromVendor(vendor: Vendor): Record<string, unknown> {
  const data: Record<string, unknown> = {
    vendor_type: vendor.vendorType,
    email: vendor.email ?? '',
    physical_address: vendor.physicalAddress ?? '',
    fax_number: vendor.faxNumber ?? '',
    global_location_number: vendor.globalLocationNumber ?? '',
    isic_v4_code: vendor.isicV4Code ?? '',
    associated_brands: vendor.associatedBrands ?? [],
    awards_won: vendor.awardsWon ?? '',
    contact_point_type: vendor.contactPoint?.contactType ?? '',
    contact_point_telephone: vendor.contactPoint?.telephone ?? '',
    contact_point_email: vendor.contactPoint?.email ?? '',
    funder: vendor.funder ?? '',
    has_offer_catalog_url: vendor.hasOfferCatalogUrl ?? '',
    point_of_sale_locations: vendor.pointOfSaleLocations ?? '',
    accepted_payment_methods: vendor.acceptedPaymentMethods ?? [],
  };

  if (vendor.vendorType === 'Person') {
    data.honorific_prefix = vendor.honorificPrefix ?? '';
    data.given_name = vendor.givenName ?? '';
    data.additional_name = vendor.additionalName ?? '';
    data.family_name = vendor.familyName ?? '';
    data.honorific_suffix = vendor.honorificSuffix ?? '';
    data.job_title = vendor.jobTitle ?? '';
    data.gender = vendor.gender ?? '';
    data.nationality_country_id = vendor.nationalityCountryId !== null && vendor.nationalityCountryId !== undefined
      ? String(vendor.nationalityCountryId)
      : '';
    data.height = vendor.height ?? '';
    data.net_worth = vendor.netWorth ?? '';
  } else {
    data.legal_name = vendor.legalName ?? '';
    data.registration_info = vendor.registrationInfo ?? '';
    data.duns_number = vendor.dunsNumber ?? '';
    data.founding_date = vendor.foundingDate ?? '';
    data.founding_location = vendor.foundingLocation ?? '';
    data.dissolution_date = vendor.dissolutionDate ?? '';
    data.department = vendor.department ?? '';
    data.ethics_policy_url = vendor.compliancePolicies?.ethicsPolicyUrl ?? '';
    data.diversity_policy_url = vendor.compliancePolicies?.diversityPolicyUrl ?? '';
    data.corrections_policy_url = vendor.compliancePolicies?.correctionsPolicyUrl ?? '';
    data.actionable_feedback_policy_url = vendor.compliancePolicies?.actionableFeedbackPolicyUrl ?? '';
  }

  return data;
}
