// Pure helpers + Zod schemas for the Subscription page's mock dialogs
// (Upgrade/Cancel/Contact Sales/Add Payment Method/Billing Details). This
// module has no backend contract (see types/subscription.ts) — every schema
// here validates local component state only, nothing is sent over the wire.

import { z } from 'zod';
import type { PlanTier, CardBrand } from '@/types/subscription';

// ── Plan feature diff ────────────────────────────────────────────────────────

/** Features present on `target` but not on `current` — drives the "What's
 *  new" list in UpgradePlanDialog. Plain string-set difference since mock
 *  PlanTier features have no stable id, only label text. */
export function newFeatures(current: PlanTier, target: PlanTier): string[] {
  const currentSet = new Set(current.features);
  return target.features.filter((f) => !currentSet.has(f));
}

// ── Card brand detection (mock — no real card processing) ───────────────────

const BRAND_PREFIXES: { brand: CardBrand; test: (digits: string) => boolean }[] = [
  { brand: 'Amex', test: (d) => /^3[47]/.test(d) },
  { brand: 'Mastercard', test: (d) => /^(5[1-5]|2[2-7])/.test(d) },
  { brand: 'Visa', test: (d) => /^4/.test(d) },
];

/** Derives a card brand from its leading digits (basic issuer-prefix
 *  ranges). Falls back to Visa for an unrecognized prefix — this is a mock
 *  form with no real card network lookup, so an exact match is unreachable
 *  for out-of-range test numbers and a default keeps the UI from rendering
 *  an "unknown brand" state. */
export function cardBrandFromNumber(cardNumber: string): CardBrand {
  const digits = cardNumber.replace(/\D/g, '');
  return BRAND_PREFIXES.find((b) => b.test(digits))?.brand ?? 'Visa';
}

/** Last 4 digits of a card number for display — empty string when fewer
 *  than 4 digits were entered. */
export function cardLast4(cardNumber: string): string {
  const digits = cardNumber.replace(/\D/g, '');
  return digits.length >= 4 ? digits.slice(-4) : '';
}

// ── Zod schemas ───────────────────────────────────────────────────────────────

export const cancelReasonOptions: { value: 'too_expensive' | 'missing_features' | 'switching_tools' | 'other'; label: string }[] = [
  { value: 'too_expensive', label: 'Too expensive' },
  { value: 'missing_features', label: 'Missing features' },
  { value: 'switching_tools', label: 'Switching tools' },
  { value: 'other', label: 'Other' },
];

export const contactSalesSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  workEmail: z.string().min(1, 'Work email is required').email('Enter a valid email address'),
  companySize: z.enum(['small', 'medium', 'large', 'enterprise'], {
    message: 'Select a company size',
  }),
  message: z.string().optional(),
});
export type ContactSalesFormValues = z.infer<typeof contactSalesSchema>;

export const COMPANY_SIZE_OPTIONS: { value: ContactSalesFormValues['companySize']; label: string }[] = [
  { value: 'small', label: '1–10 employees' },
  { value: 'medium', label: '11–50 employees' },
  { value: 'large', label: '51–200 employees' },
  { value: 'enterprise', label: '200+ employees' },
];

function isFutureOrCurrentExpiry(expiry: string): boolean {
  const match = /^(\d{2})\/(\d{2})$/.exec(expiry);
  if (!match) return false;
  const month = Number(match[1]);
  const year = 2000 + Number(match[2]);
  if (month < 1 || month > 12) return false;
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;
  return year > currentYear || (year === currentYear && month >= currentMonth);
}

/** Maps a validated Add Payment Method submission to the fields stored on a
 *  PaymentMethod — id and isDefault are assigned by the caller (SubscriptionPage
 *  owns list-level concerns like "is this the first card"). */
export function toPaymentMethodInput(values: { cardNumber: string; expiry: string }): {
  brand: CardBrand
  last4: string
  expiry: string
} {
  return {
    brand: cardBrandFromNumber(values.cardNumber),
    last4: cardLast4(values.cardNumber),
    expiry: values.expiry,
  };
}

export const addPaymentMethodSchema = z.object({
  cardNumber: z
    .string()
    .min(1, 'Card number is required')
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length >= 13 && v.length <= 19, 'Enter a valid card number'),
  expiry: z
    .string()
    .min(1, 'Expiry is required')
    .refine((v) => /^\d{2}\/\d{2}$/.test(v), 'Use MM/YY format')
    .refine(isFutureOrCurrentExpiry, 'Card has expired'),
  cvc: z
    .string()
    .min(1, 'CVC is required')
    .refine((v) => /^\d{3,4}$/.test(v), 'Enter a valid CVC'),
  cardholderName: z.string().min(1, 'Cardholder name is required'),
});
export type AddPaymentMethodFormValues = z.infer<typeof addPaymentMethodSchema>;

export const billingContactSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().min(1, 'Email is required').email('Enter a valid email address'),
  addressLine1: z.string().min(1, 'Address is required'),
  addressLine2: z.string().optional(),
  city: z.string().min(1, 'City is required'),
  state: z.string().min(1, 'State is required'),
  postalCode: z.string().min(1, 'Postal code is required'),
  country: z.string().min(1, 'Country is required'),
});
export type BillingContactFormValues = z.infer<typeof billingContactSchema>;
