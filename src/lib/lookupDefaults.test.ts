import { describe, it, expect } from 'vitest';
import {
  DEFAULT_COUNTRY_NAME, defaultCountryId, defaultCountryName, defaultCurrencyId, defaultUnitId,
} from './lookupDefaults';

function item(id: number, code: string, name = '') {
  return { id, code, name };
}

describe('DEFAULT_COUNTRY_NAME', () => {
  it('matches the lkp_country seed row name for DEFAULT_COUNTRY_CODE', () => {
    expect(DEFAULT_COUNTRY_NAME).toBe('United States of America');
  });
});

describe('defaultCountryName', () => {
  it('finds the name for code US', () => {
    expect(defaultCountryName([item(7, 'CA', 'Canada'), item(3, 'US', 'United States of America')])).toBe(
      'United States of America',
    );
  });

  it.each([undefined, []])('falls back to DEFAULT_COUNTRY_NAME when lookups are %p', (countries) => {
    expect(defaultCountryName(countries)).toBe(DEFAULT_COUNTRY_NAME);
  });

  it('falls back to DEFAULT_COUNTRY_NAME when US is missing/deactivated', () => {
    expect(defaultCountryName([item(7, 'CA', 'Canada')])).toBe(DEFAULT_COUNTRY_NAME);
  });
});

describe('defaultCountryId', () => {
  it('finds the id for code US', () => {
    expect(defaultCountryId([item(7, 'CA'), item(3, 'US')])).toBe('3');
  });

  it.each([undefined, []])('returns \'\' when lookups are %p', (countries) => {
    expect(defaultCountryId(countries)).toBe('');
  });

  it('returns \'\' when US is missing/deactivated', () => {
    expect(defaultCountryId([item(7, 'CA')])).toBe('');
  });
});

describe('defaultCurrencyId', () => {
  it('finds the id for code USD', () => {
    expect(defaultCurrencyId([item(9, 'EUR'), item(1, 'USD')])).toBe('1');
  });

  it.each([undefined, []])('returns \'\' when lookups are %p', (currencies) => {
    expect(defaultCurrencyId(currencies)).toBe('');
  });
});

describe('defaultUnitId', () => {
  it('finds the id for code SQFT', () => {
    expect(defaultUnitId([item(2, 'EA'), item(5, 'SQFT')])).toBe('5');
  });

  it.each([undefined, []])('returns \'\' when lookups are %p', (units) => {
    expect(defaultUnitId(units)).toBe('');
  });

  it('returns \'\' when SQFT is missing/deactivated', () => {
    expect(defaultUnitId([item(2, 'EA')])).toBe('');
  });
});
