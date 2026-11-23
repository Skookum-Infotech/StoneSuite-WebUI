// Zod schema for the Locations tab (Configuration -> Company Info) — a
// physical address the tenant operates from, edited via
// POST/PATCH /api/tenant/company-locations. Bounds mirror the backend's
// companylocation.Validate (VARCHAR(255) columns).

import { z } from 'zod';
import { isInvalidPhoneValue } from './phoneValidation';

export const MAX_FIELD_LENGTH = 255;

// .default('') rather than .optional(): the form always supplies a string,
// so the inferred output type should stay `string`, matching CompanyLocation.
const shortField = z.string().max(MAX_FIELD_LENGTH, `Must be at most ${MAX_FIELD_LENGTH} characters`).default('');

// Real per-country validity, not just a length bound — see phoneValidation.ts.
const phoneField = shortField.refine((v) => !isInvalidPhoneValue(v), 'Enter a valid phone number');

// Same line1/line2/suite/city/country/state/zip shape as CompanyProfile's own
// address fields (lib/companyProfileForm.ts) — every sub-field optional,
// matching the backend's companylocation.Address.
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

export const companyLocationSchema = z.object({
  name: z
    .string()
    .transform((v) => v.trim())
    .refine((v) => v.length > 0, 'Location name is required')
    .refine((v) => v.length <= MAX_FIELD_LENGTH, `Must be at most ${MAX_FIELD_LENGTH} characters`),
  phone: phoneField,
  // .default({}) so an entirely-omitted address (e.g. a brand-new location)
  // still parses -- the nested per-field defaults then fill in ''.
  address: addressSchema.default(EMPTY_ADDRESS),
});

export type CompanyLocationFormValues = z.infer<typeof companyLocationSchema>;
