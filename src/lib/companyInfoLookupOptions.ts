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

import type { CrmLookups, LookupItem } from '@/services/lookupService';

export interface SelectOption {
  value: string;
  label: string;
  // Optional <optgroup> heading; options without one render ungrouped.
  group?: string;
}

function withCurrentValue(options: SelectOption[], currentValue: string): SelectOption[] {
  const trimmed = currentValue.trim();
  if (!trimmed || options.some((o) => o.value === trimmed)) return options;
  return [{ value: trimmed, label: `${trimmed} (current)` }, ...options];
}

// Takes the bare countries/currencies array (not the full CrmLookups
// object) so callers with a narrower fetch than getCrmLookups -- the public
// onboarding form's own /onboarding/lookups, which has no tenant JWT to
// call getCrmLookups with -- can reuse the same option-mapping and
// preserve-current-value safeguard as Company Profile/Locations.
export function countryOptions(countries: LookupItem[] | undefined, currentValue: string): SelectOption[] {
  const base = (countries ?? []).map((c) => ({ value: c.name, label: c.name }));
  return withCurrentValue(base, currentValue);
}

export function currencyOptions(currencies: LookupItem[] | undefined, currentValue: string): SelectOption[] {
  const base = (currencies ?? []).map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }));
  return withCurrentValue(base, currentValue);
}

const UTC_ZONE = 'UTC';
const OTHER_TIMEZONE_GROUP = 'Other';

// ICU (so every browser's Intl.supportedValuesOf) still lists these zones under
// their pre-rename IANA names; the current names below are what users look
// for and what the backend's tzdata resolves too.
const RENAMED_ZONES: Record<string, string> = {
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Europe/Kiev': 'Europe/Kyiv',
  'America/Buenos_Aires': 'America/Argentina/Buenos_Aires',
  'Atlantic/Faeroe': 'Atlantic/Faroe',
  'Pacific/Truk': 'Pacific/Chuuk',
};

// "GMT+05:30" -> "UTC+05:30"; the bare "GMT" the runtime returns for a zero
// offset becomes "UTC+00:00" so every label has the same shape.
function utcOffsetLabel(zone: string, at: Date): string {
  try {
    const raw = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value;
    if (!raw) return '';
    return raw === 'GMT' ? 'UTC+00:00' : raw.replace('GMT', 'UTC');
  } catch {
    return '';
  }
}

// The runtime's own IANA zone list (the same names the backend resolves with
// time.LoadLocation), grouped by region and labelled with today's UTC offset
// so a user can find "their" zone without knowing its IANA name. The saved
// value stays the plain IANA name. Runtimes without Intl.supportedValuesOf
// fall back to UTC alone plus whatever is already saved.
export function timezoneOptions(currentValue: string, now: Date = new Date()): SelectOption[] {
  const supported = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : [];
  const current = supported.map((zone) => RENAMED_ZONES[zone] ?? zone).sort();
  const zones = current.includes(UTC_ZONE) ? current : [...current, UTC_ZONE];
  const base = zones.map((zone) => {
    const offset = utcOffsetLabel(zone, now);
    const name = zone.replace(/_/g, ' ');
    return {
      value: zone,
      label: offset ? `${name} (${offset})` : name,
      group: zone.includes('/') ? zone.split('/')[0] : OTHER_TIMEZONE_GROUP,
    };
  });
  return withCurrentValue(base, currentValue);
}

// Filtered by the country field's own current text, resolved against
// countries[].id -- when that text matches no known country (blank, or a
// legacy/unrecognized value), every state is offered rather than none, so
// the field never strands the user with an empty dropdown. Takes just the
// countries + states (not the full CrmLookups) so the public onboarding form,
// whose /onboarding/lookups carries only those, shares this same filtering.
export function stateOptionsForCountry(
  lookups: Pick<CrmLookups, 'countries' | 'states'> | undefined,
  countryValue: string,
  currentValue: string,
): SelectOption[] {
  const countryId = lookups?.countries.find((c) => c.name === countryValue)?.id;
  const states = lookups?.states ?? [];
  const matching = countryId !== undefined ? states.filter((s) => s.countryId === countryId) : states;
  const base = matching.map((s) => ({ value: s.name, label: s.name }));
  return withCurrentValue(base, currentValue);
}
