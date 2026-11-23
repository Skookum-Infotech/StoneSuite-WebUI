export interface TenantMetadataSummary {
  contactEmail: string;
  phone: string;
  industry: string;
  website: string;
  /** Every other non-empty string field, in the order the backend sent them. */
  extra: Array<[string, string]>;
}

// Onboarding metadata is free-form (it is the Customer workflow's field keys),
// so the same value can arrive under more than one key. Earlier keys win.
const CONTACT_EMAIL_KEYS = ['super_admin_email', 'contact_email', 'email'];
const PHONE_KEYS = ['phone', 'contact_phone'];
const INDUSTRY_KEYS = ['industry', 'business_type'];
const WEBSITE_KEYS = ['website', 'company_website'];
const COMPANY_NAME_KEY = 'company_name';

const SURFACED_KEYS = new Set([
  COMPANY_NAME_KEY,
  ...CONTACT_EMAIL_KEYS,
  ...PHONE_KEYS,
  ...INDUSTRY_KEYS,
  ...WEBSITE_KEYS,
]);

function firstString(meta: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = meta[key];
    if (typeof value === 'string' && value !== '') return value;
  }
  return '';
}

/** Splits a tenant's onboarding metadata into the headline contact fields and the rest. */
export function describeTenantMetadata(meta: Record<string, unknown> | undefined): TenantMetadataSummary {
  const data = meta ?? {};
  return {
    contactEmail: firstString(data, CONTACT_EMAIL_KEYS),
    phone: firstString(data, PHONE_KEYS),
    industry: firstString(data, INDUSTRY_KEYS),
    website: firstString(data, WEBSITE_KEYS),
    extra: Object.entries(data).filter(
      (entry): entry is [string, string] =>
        !SURFACED_KEYS.has(entry[0]) && typeof entry[1] === 'string' && entry[1] !== '',
    ),
  };
}
