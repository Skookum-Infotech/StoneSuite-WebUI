// Real per-country phone-number validity checking, backing every `type: 'tel'`
// field's format check across the app. libphonenumber-js already encodes each
// country's actual numbering-plan rules — valid lengths and prefixes vary
// widely (a US number is 10 digits, but that's not a universal rule) — so
// this wraps its validator rather than hand-rolling a fixed digit count.
// Lives in `lib`, not `components/crm/formUtils`, so `lib`-only modules
// (crmValidation, vendorForm, the document-module field-def files) can use it
// without importing from `components` — formUtils.ts's sanitize/country-code
// helpers are a separate, live-typing concern from this validity check.
import { getCountries, getCountryCallingCode, isValidPhoneNumber } from 'libphonenumber-js';

/** True when `raw` is a non-empty value that isn't a real, dialable phone
 *  number. Empty is never "invalid" here — pair with a field's own
 *  `required` check for that, matching how CRM's `isOutOfRange` treats
 *  `type: 'number'` fields. A value with no leading '+' (legacy data entered
 *  before the country-code selector existed) is checked against the US plan,
 *  matching PhoneNumberInput's own default dial code. */
export function isInvalidPhoneValue(raw: string): boolean {
  const trimmed = raw.trim();
  if (trimmed === '') return false;
  return !isValidPhoneNumber(trimmed, 'US');
}

/** Returns the label of the first `type: 'tel'` field in `fields` whose
 *  current value in `values` is a non-empty but invalid phone number, or
 *  null when every tel field is valid (or empty). Used by document-module
 *  Add/Edit pages to block a save the same way their other pre-flight checks
 *  already do — throwing inside the mutation's `mutationFn` so the existing
 *  save-error banner picks it up, with no extra validation state needed. */
export function firstInvalidPhoneLabel(
  fields: { key: string; label: string; type?: string }[],
  values: Record<string, unknown>,
): string | null {
  for (const f of fields) {
    if (f.type !== 'tel') continue;
    const v = values[f.key];
    if (typeof v === 'string' && isInvalidPhoneValue(v)) return f.label;
  }
  return null;
}

const CALLING_CODES: ReadonlySet<string> = new Set(
  getCountries().map((iso) => getCountryCallingCode(iso)),
);
const MAX_CALLING_CODE_DIGITS = 3;

/** Reads the dial code (e.g. '+44') off the front of a stored phone value, or
 *  null when the value has no leading '+' or no recognised code. Calling codes
 *  are prefix-free, so the first match of 1–3 digits is the code. Lets
 *  PhoneNumberInput show the code a saved number was actually entered with
 *  rather than always defaulting its selector to +1. */
export function detectCountryCode(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed.startsWith('+')) return null;
  const digits = trimmed.slice(1).replace(/\D/g, '');
  for (let len = 1; len <= MAX_CALLING_CODE_DIGITS; len++) {
    const candidate = digits.slice(0, len);
    if (candidate.length === len && CALLING_CODES.has(candidate)) return `+${candidate}`;
  }
  return null;
}
