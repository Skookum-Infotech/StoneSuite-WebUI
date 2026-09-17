// Turns the CRM lookups (backend-driven country/state/currency lists) into
// <select> options for Company Info fields that still store plain text
// (company_profile.country/currency and every address's country/state are
// VARCHAR columns, not lookup-id foreign keys — see companyLocationForm.ts
// and companyProfileForm.ts). This is a curated-values dropdown layered on
// top of free-text storage, not a relational rewrite: the value saved is
// still the country/state name or currency code, unchanged from before.
//
// Every option list preserves the field's current value even when it
// matches no lookup entry (a legacy value like "USA" instead of "United
// States", or one no longer in the list) -- otherwise selecting through a
// dropdown that silently drops an unrecognized value and saving would
// blank out already-saved data the user never intended to change.

import type { CrmLookups } from '@/services/lookupService';

export interface SelectOption {
  value: string;
  label: string;
}

function withCurrentValue(options: SelectOption[], currentValue: string): SelectOption[] {
  const trimmed = currentValue.trim();
  if (!trimmed || options.some((o) => o.value === trimmed)) return options;
  return [{ value: trimmed, label: `${trimmed} (current)` }, ...options];
}

export function countryOptions(lookups: CrmLookups | undefined, currentValue: string): SelectOption[] {
  const base = (lookups?.countries ?? []).map((c) => ({ value: c.name, label: c.name }));
  return withCurrentValue(base, currentValue);
}

export function currencyOptions(lookups: CrmLookups | undefined, currentValue: string): SelectOption[] {
  const base = (lookups?.currencies ?? []).map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }));
  return withCurrentValue(base, currentValue);
}

// Filtered by the country field's own current text, resolved against
// countries[].id -- when that text matches no known country (blank, or a
// legacy/unrecognized value), every state is offered rather than none, so
// the field never strands the user with an empty dropdown.
export function stateOptionsForCountry(
  lookups: CrmLookups | undefined,
  countryValue: string,
  currentValue: string,
): SelectOption[] {
  const countryId = lookups?.countries.find((c) => c.name === countryValue)?.id;
  const states = lookups?.states ?? [];
  const matching = countryId !== undefined ? states.filter((s) => s.countryId === countryId) : states;
  const base = matching.map((s) => ({ value: s.name, label: s.name }));
  return withCurrentValue(base, currentValue);
}
