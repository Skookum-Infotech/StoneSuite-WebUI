// Zod schema for the Company Info page (Configuration -> Company Info) — the
// tenant's own company name/address, edited via PUT /api/tenant/company-profile.
// Bounds mirror the backend's companyprofile.Validate (VARCHAR(255)/TEXT columns).

import { z } from 'zod';

export const MAX_SHORT_FIELD_LENGTH = 255;
export const MAX_ADDRESS_LENGTH = 5000;

// .default('') rather than .optional(): the form always supplies a string
// (RHF's defaultValues seeds every field with ''), so the inferred output
// type should stay `string`, matching CompanyProfile — not `string | undefined`.
const shortField = z.string().max(MAX_SHORT_FIELD_LENGTH, `Must be at most ${MAX_SHORT_FIELD_LENGTH} characters`).default('');
const addressField = z.string().max(MAX_ADDRESS_LENGTH, `Must be at most ${MAX_ADDRESS_LENGTH} characters`).default('');

export const companyProfileSchema = z.object({
  companyName: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, 'Company name is required')
    .refine((v) => v.length <= MAX_SHORT_FIELD_LENGTH, `Must be at most ${MAX_SHORT_FIELD_LENGTH} characters`),
  legalName: shortField,
  industry: shortField,
  website: shortField,
  country: shortField,
  currency: shortField,
  timezone: shortField,
  taxId: shortField,
  billingAddress: addressField,
  shippingAddress: addressField,
  returnAddress: addressField,
});

export type CompanyProfileFormValues = z.infer<typeof companyProfileSchema>;
