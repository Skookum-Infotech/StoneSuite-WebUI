// Resolves the "new record" default country/currency/unit selection from the backend's
// lkp_country/lkp_currency/lkp_unit lookup rows (services/lookupService.ts,
// services/inventoryLookupService.ts) by their stable code, never by numeric id — the id
// is a backend-assigned SERIAL and isn't guaranteed to be the same value across
// tenants/environments, but the seeded code is.

type CodedLookupItem = { id: number; code: string };

export const DEFAULT_COUNTRY_CODE = 'US';
export const DEFAULT_CURRENCY_CODE = 'USD';
export const DEFAULT_UNIT_CODE = 'SQFT';

function idForCode(items: CodedLookupItem[] | undefined, code: string): string {
  const match = items?.find((item) => item.code === code);
  return match ? String(match.id) : '';
}

/** Lookup id for the default country (United States), or '' if lookups haven't
 *  loaded yet or the code is missing/deactivated. */
export function defaultCountryId(countries: CodedLookupItem[] | undefined): string {
  return idForCode(countries, DEFAULT_COUNTRY_CODE);
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
