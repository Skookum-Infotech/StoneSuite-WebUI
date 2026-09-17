import { describe, it, expect } from 'vitest';
import { defaultCountryId, defaultCurrencyId, defaultUnitId } from './lookupDefaults';

function item(id: number, code: string) {
  return { id, code };
}

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
