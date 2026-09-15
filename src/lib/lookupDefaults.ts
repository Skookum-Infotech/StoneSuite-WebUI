// Resolves the "new record" default country/currency selection from the backend's
// lkp_country/lkp_currency lookup rows (services/lookupService.ts) by their stable ISO
// code, never by numeric id — the id is a backend-assigned SERIAL and isn't guaranteed
// to be the same value across tenants/environments, but the seeded code is.

import type { LookupItem } from '@/services/lookupService';

export const DEFAULT_COUNTRY_CODE = 'US';
export const DEFAULT_CURRENCY_CODE = 'USD';

function idForCode(items: LookupItem[] | undefined, code: string): string {
  const match = items?.find((item) => item.code === code);
  return match ? String(match.id) : '';
}

/** Lookup id for the default country (United States), or '' if lookups haven't
 *  loaded yet or the code is missing/deactivated. */
export function defaultCountryId(countries: LookupItem[] | undefined): string {
  return idForCode(countries, DEFAULT_COUNTRY_CODE);
}

/** Lookup id for the default currency (USD), or '' if lookups haven't loaded
 *  yet or the code is missing/deactivated. */
export function defaultCurrencyId(currencies: LookupItem[] | undefined): string {
  return idForCode(currencies, DEFAULT_CURRENCY_CODE);
}
