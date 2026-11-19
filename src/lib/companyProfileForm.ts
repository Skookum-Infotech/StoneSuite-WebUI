// Zod schema for the Company Info page (Configuration -> Company Info) — the
// tenant's own company name/address, edited via PUT /api/tenant/company-profile.
// Bounds mirror the backend's companyprofile.Validate (VARCHAR(255) columns).

import { z } from 'zod';
import { DEFAULT_FABRICATION_PERCENT } from '@/types/companyProfile';

export const MAX_FIELD_LENGTH = 255;

// .default('') rather than .optional(): the form always supplies a string
// (RHF's defaultValues seeds every field with ''), so the inferred output
// type should stay `string`, matching CompanyProfile — not `string | undefined`.
const shortField = z.string().max(MAX_FIELD_LENGTH, `Must be at most ${MAX_FIELD_LENGTH} characters`).default('');

// Same line1/line2/suite/city/country/state/zip shape as a CRM record's own
// address fields (lib/crmFields.ts) — every sub-field optional, matching the
// backend's companyprofile.Address.
const addressSchema = z.object({
  line1: shortField,
  line2: shortField,
  suite: shortField,
  city: shortField,
  country: shortField,
  state: shortField,
  zip: shortField,
});

// z.object(...).default(value) substitutes value directly rather than
// re-parsing it through the schema, so the default must already be the full
// shape (every sub-field's own .default('') never runs in that case).
const EMPTY_ADDRESS = { line1: '', line2: '', suite: '', city: '', country: '', state: '', zip: '' } as const;

// Bank details printed on invoices, quotes, estimates and sales orders — every
// field optional, matching the backend's companyprofile.PaymentDetails.
const paymentDetailsSchema = z.object({
  bankName: shortField,
  accountNumber: shortField,
  routingNumber: shortField,
});

const EMPTY_PAYMENT_DETAILS = { bankName: '', accountNumber: '', routingNumber: '' } as const;

// Mirrors the backend's companyprofile.MaxWordingLength.
export const MAX_WORDING_LENGTH = 5000;

// Mirrors the backend's companyprofile.MaxFabricationPercent — comfortably
// covers any real markup while still catching a stray typo.
export const MAX_FABRICATION_PERCENT = 1000;

// Company Preferences tab: fabrication sq ft = countertop sq ft * (1 +
// fabricationPercent / 100). z.coerce because the input renders the value as
// a text-pattern numeric field (CompanyInfoTextField), same as every other
// field in this form.
const fabricationPercentField = z.coerce
  .number()
  .min(0, 'Must be at least 0')
  .max(MAX_FABRICATION_PERCENT, `Must be at most ${MAX_FABRICATION_PERCENT}`)
  .default(DEFAULT_FABRICATION_PERCENT);

const wordingField = z.string().max(MAX_WORDING_LENGTH, `Must be at most ${MAX_WORDING_LENGTH} characters`).default('');

const wordingSchema = z.object({ terms: wordingField, notes: wordingField });

const EMPTY_WORDING = { terms: '', notes: '' } as const;

// Default Terms & Notes per document type (see types/companyProfile.ts).
const documentDefaultsSchema = z.object({
  estimate: wordingSchema.default(EMPTY_WORDING),
  quote: wordingSchema.default(EMPTY_WORDING),
  sales_order: wordingSchema.default(EMPTY_WORDING),
  invoice: wordingSchema.default(EMPTY_WORDING),
});

const EMPTY_DOCUMENT_DEFAULTS = {
  estimate: EMPTY_WORDING, quote: EMPTY_WORDING, sales_order: EMPTY_WORDING, invoice: EMPTY_WORDING,
} as const;

export const companyProfileSchema = z.object({
  companyName: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, 'Company name is required')
    .refine((v) => v.length <= MAX_FIELD_LENGTH, `Must be at most ${MAX_FIELD_LENGTH} characters`),
  legalName: shortField,
  industry: shortField,
  website: shortField,
  country: shortField,
  currency: shortField,
  timezone: shortField,
  taxId: shortField,
  fabricationPercent: fabricationPercentField,
  // .default({}) so an entirely-omitted address (e.g. a brand-new profile)
  // still parses -- the nested per-field defaults then fill in ''.
  billingAddress: addressSchema.default(EMPTY_ADDRESS),
  shippingAddress: addressSchema.default(EMPTY_ADDRESS),
  returnAddress: addressSchema.default(EMPTY_ADDRESS),
  paymentDetails: paymentDetailsSchema.default(EMPTY_PAYMENT_DETAILS),
  documentDefaults: documentDefaultsSchema.default(EMPTY_DOCUMENT_DEFAULTS),
});

export type CompanyProfileFormValues = z.infer<typeof companyProfileSchema>;
export type AddressFormValues = z.infer<typeof addressSchema>;
