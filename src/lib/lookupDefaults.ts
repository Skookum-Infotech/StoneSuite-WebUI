// Resolves the "new record" default country/currency/unit selection from the backend's
// lkp_country/lkp_currency/lkp_unit lookup rows (services/lookupService.ts,
// services/inventoryLookupService.ts) by their stable code, never by numeric id — the id
// is a backend-assigned SERIAL and isn't guaranteed to be the same value across
// tenants/environments, but the seeded code is.

type CodedLookupItem = { id: number; code: string };
type NamedLookupItem = CodedLookupItem & { name: string };

export const DEFAULT_COUNTRY_CODE = 'US';
export const DEFAULT_CURRENCY_CODE = 'USD';
export const DEFAULT_UNIT_CODE = 'SQFT';

// The lkp_country seed row's exact country_name for DEFAULT_COUNTRY_CODE
// (StoneSuite-Backend database/migrations/tenant/schema.sql). Prefer
// defaultCountryName() below when a lookup fetch is available -- this is
// the last-resort fallback for a form that has none at all (the
// Subscription billing tab is still local mock state) or hasn't resolved
// its fetch yet. Company Profile's own country/address fields are
// free-text VARCHAR columns, not lookup-id foreign keys, so nothing
// reconciles them against the lookup table after save -- a form that
// hardcodes a differently-worded default (e.g. "United States" instead of
// "United States of America") silently produces two different country
// labels on the same record. Keep this in sync with the seed row rather
// than letting a form's fallback invent its own wording.
export const DEFAULT_COUNTRY_NAME = 'United States of America';

function idForCode(items: CodedLookupItem[] | undefined, code: string): string {
  const match = items?.find((item) => item.code === code);
  return match ? String(match.id) : '';
}

/** Lookup id for the default country (United States), or '' if lookups haven't
 *  loaded yet or the code is missing/deactivated. */
export function defaultCountryId(countries: CodedLookupItem[] | undefined): string {
  return idForCode(countries, DEFAULT_COUNTRY_CODE);
}

/** Lookup display name for the default country, straight from the lookup
 *  table (not a hardcoded label) -- falls back to DEFAULT_COUNTRY_NAME only
 *  when the fetch hasn't resolved yet or the code is missing/deactivated,
 *  since a caller here (unlike defaultCountryId's relational-FK callers)
 *  needs a display-ready value even before/without a lookup fetch. */
export function defaultCountryName(countries: NamedLookupItem[] | undefined): string {
  return countries?.find((item) => item.code === DEFAULT_COUNTRY_CODE)?.name ?? DEFAULT_COUNTRY_NAME;
}

/** Lookup id for the default currency (USD), or '' if lookups haven't loaded
 *  yet or the code is missing/deactivated. */
export function defaultCurrencyId(currencies: CodedLookupItem[] | undefined): string {
  return idForCode(currencies, DEFAULT_CURRENCY_CODE);
}

/** Lookup id for the default unit (Square Foot), or '' if lookups haven't loaded
 *  yet or the code is missing/deactivated. */
export function defaultUnitId(units: CodedLookupItem[] | undefined): string {
  return idForCode(units, DEFAULT_UNIT_CODE);
}
