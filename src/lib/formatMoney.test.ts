import { describe, it, expect } from 'vitest';
import { formatMoney, currencyCodeFor } from './formatMoney';

describe('formatMoney', () => {
  it.each([
    [1234.5, 'USD', '$1,234.50'],
    [1234.5, undefined, '$1,234.50'],
    [1234.5, 'not-a-code', '$1,234.50'],
    [undefined, 'USD', '$0.00'],
    [-5, 'USD', '-$5.00'],
  ])('formats %s in %s', (n, code, expected) => {
    expect(formatMoney(n, code)).toBe(expected);
  });

  it('uses the given currency', () => {
    expect(formatMoney(10, 'EUR')).toContain('€');
  });
});

describe('currencyCodeFor', () => {
  const lookups = { currencies: [{ id: 1, code: 'USD' }, { id: 2, code: 'EUR' }] };
  it.each([
    [2, 'EUR'], ['2', 'EUR'], [9, undefined], [undefined, undefined], ['', undefined],
  ])('resolves %s', (id, expected) => {
    expect(currencyCodeFor(lookups, id)).toBe(expected);
  });
  it('handles missing lookups', () => {
    expect(currencyCodeFor(undefined, 1)).toBeUndefined();
  });
});
