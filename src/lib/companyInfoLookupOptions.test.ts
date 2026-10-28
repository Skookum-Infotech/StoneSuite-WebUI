import { describe, it, expect } from 'vitest';
import { countryOptions, currencyOptions, stateOptionsForCountry, timezoneOptions } from './companyInfoLookupOptions';
import type { CrmLookups } from '@/services/lookupService';

function lookups(overrides: Partial<CrmLookups> = {}): CrmLookups {
  return {
    customerTypes: [],
    crmStatuses: [],
    arStatuses: [],
    paymentTerms: [],
    priceLevels: [],
    leadSources: [],
    contactMethods: [],
    employees: [],
    parentCustomers: [],
    countries: [
      { id: 1, code: 'US', name: 'United States' },
      { id: 2, code: 'CA', name: 'Canada' },
    ],
    currencies: [
      { id: 1, code: 'USD', name: 'US Dollar' },
      { id: 2, code: 'CAD', name: 'Canadian Dollar' },
    ],
    states: [
      { id: 1, code: 'IL', name: 'Illinois', countryId: 1 },
      { id: 2, code: 'TX', name: 'Texas', countryId: 1 },
      { id: 3, code: 'ON', name: 'Ontario', countryId: 2 },
    ],
    ...overrides,
  };
}

describe('countryOptions', () => {
  it('maps countries to value/label pairs keyed by name', () => {
    expect(countryOptions(lookups().countries, '')).toEqual([
      { value: 'United States', label: 'United States' },
      { value: 'Canada', label: 'Canada' },
    ]);
  });

  it('does not duplicate the current value when it already matches a lookup entry', () => {
    const result = countryOptions(lookups().countries, 'Canada');
    expect(result.filter((o) => o.value === 'Canada')).toHaveLength(1);
  });

  it('prepends the current value when it matches no lookup entry, so saving does not blank it out', () => {
    const result = countryOptions(lookups().countries, 'USA');
    expect(result[0]).toEqual({ value: 'USA', label: 'USA (current)' });
    expect(result).toHaveLength(3);
  });

  it('ignores a blank current value', () => {
    expect(countryOptions(lookups().countries, '')).toHaveLength(2);
    expect(countryOptions(lookups().countries, '   ')).toHaveLength(2);
  });

  it('returns an empty list when lookups have not loaded yet', () => {
    expect(countryOptions(undefined, '')).toEqual([]);
  });

  it('still preserves the current value when lookups have not loaded yet', () => {
    expect(countryOptions(undefined, 'United States')).toEqual([
      { value: 'United States', label: 'United States (current)' },
    ]);
  });
});

describe('currencyOptions', () => {
  it('maps currencies to value/label pairs keyed by code, labeled with the full name', () => {
    expect(currencyOptions(lookups().currencies, '')).toEqual([
      { value: 'USD', label: 'USD — US Dollar' },
      { value: 'CAD', label: 'CAD — Canadian Dollar' },
    ]);
  });

  it('prepends the current value when it matches no lookup entry', () => {
    const result = currencyOptions(lookups().currencies, 'EUR');
    expect(result[0]).toEqual({ value: 'EUR', label: 'EUR (current)' });
  });
});

describe('stateOptionsForCountry', () => {
  it('filters states to the ones belonging to the selected country', () => {
    expect(stateOptionsForCountry(lookups(), 'United States', '')).toEqual([
      { value: 'Illinois', label: 'Illinois' },
      { value: 'Texas', label: 'Texas' },
    ]);
  });

  it('returns every state when the country text matches no lookup entry', () => {
    const result = stateOptionsForCountry(lookups(), 'Unknownland', '');
    expect(result).toHaveLength(3);
  });

  it('returns every state when no country has been selected yet', () => {
    const result = stateOptionsForCountry(lookups(), '', '');
    expect(result).toHaveLength(3);
  });

  it('prepends the current value when it matches no option in the filtered list', () => {
    const result = stateOptionsForCountry(lookups(), 'United States', 'Springfield');
    expect(result[0]).toEqual({ value: 'Springfield', label: 'Springfield (current)' });
  });

  it('does not duplicate the current value when it already matches a filtered option', () => {
    const result = stateOptionsForCountry(lookups(), 'United States', 'Texas');
    expect(result.filter((o) => o.value === 'Texas')).toHaveLength(1);
  });
});

describe('timezoneOptions', () => {
  // Fixed instant: Asia/Kolkata has no DST, America/Chicago is on CST (UTC-06:00) in January.
  const JANUARY = new Date('2026-01-15T12:00:00Z');

  it('offers IANA zones grouped by region with the UTC offset in the label', () => {
    const options = timezoneOptions('', JANUARY);
    const kolkata = options.find((o) => o.value === 'Asia/Kolkata');
    expect(kolkata).toEqual({ value: 'Asia/Kolkata', label: 'Asia/Kolkata (UTC+05:30)', group: 'Asia' });
    const chicago = options.find((o) => o.value === 'America/Chicago');
    expect(chicago?.label).toBe('America/Chicago (UTC-06:00)');
    expect(chicago?.group).toBe('America');
  });

  it('always includes UTC, with the zero offset spelled out', () => {
    const utc = timezoneOptions('', JANUARY).find((o) => o.value === 'UTC');
    expect(utc?.label).toBe('UTC (UTC+00:00)');
    expect(utc?.group).toBe('Other');
  });

  it('lists renamed zones under their current IANA name, not the legacy alias', () => {
    const values = timezoneOptions('', JANUARY).map((o) => o.value);
    expect(values).not.toContain('Asia/Calcutta');
    expect(values).not.toContain('Europe/Kiev');
    expect(values).toContain('Europe/Kyiv');
  });

  it('keeps an unrecognised saved value selectable instead of dropping it', () => {
    const options = timezoneOptions('08:00–18:00', JANUARY);
    expect(options[0]).toEqual({ value: '08:00–18:00', label: '08:00–18:00 (current)' });
  });

  it('does not duplicate a saved value that is already a valid zone', () => {
    const options = timezoneOptions('Asia/Kolkata', JANUARY);
    expect(options.filter((o) => o.value === 'Asia/Kolkata')).toHaveLength(1);
    expect(options.some((o) => o.label.endsWith('(current)'))).toBe(false);
  });
});
