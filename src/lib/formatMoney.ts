import { DEFAULT_CURRENCY_CODE } from '@/lib/lookupDefaults';

type CurrencyLookupItem = { id: number; code: string };

/** Formats an amount in the given ISO 4217 code, falling back to the default currency when the code is missing or invalid. */
export function formatMoney(n: number | undefined | null, code?: string | null): string {
  const value = n ?? 0;
  const opts = (currency: string): Intl.NumberFormatOptions => ({ style: 'currency', currency });
  try {
    return value.toLocaleString(undefined, opts(code || DEFAULT_CURRENCY_CODE));
  } catch {
    return value.toLocaleString(undefined, opts(DEFAULT_CURRENCY_CODE));
  }
}

/** Resolves a lookup currency id (number or numeric string) to its code; undefined when unknown. */
export function currencyCodeFor(
  lookups: { currencies?: CurrencyLookupItem[] } | undefined | null,
  currencyId: number | string | null | undefined,
): string | undefined {
  if (currencyId === null || currencyId === undefined || currencyId === '') return undefined;
  const id = Number(currencyId);
  return lookups?.currencies?.find((c) => c.id === id)?.code;
}
