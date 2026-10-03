import { describe, expect, it } from 'vitest';
import { convertLine, normalizeUnit, sameUnit } from './unitConversion';

describe('normalizeUnit', () => {
  it.each([
    ['Sq. Ft', 'sqft'], ['SF', 'sqft'], ['m²', 'sqm'], ['SQM', 'sqm'], ['EA', 'ea'], ['pcs', 'ea'], ['Slab', null],
  ])('%s -> %s', (raw, want) => {
    expect(normalizeUnit(raw)).toBe(want);
  });
});

describe('sameUnit', () => {
  it.each([
    ['SF', 'SQFT', true], ['EA', 'each', true], ['SQM', 'SQFT', false], ['Slab', 'slab', true], ['Slab', 'Box', false],
  ])('%s vs %s', (a, b, want) => {
    expect(sameUnit(a, b)).toBe(want);
  });
});

describe('convertLine', () => {
  it('converts inside a category and keeps the amount', () => {
    // 10 ft at $3.048/ft == 3.048 m at $10/m (exact within a cent)
    const out = convertLine(10, 3.05, 'ft', 'm');
    expect(out).not.toBeNull();
    // Amounts compare in whole cents, matching the server's 1-cent drift rule.
    expect(Math.abs(Math.round(out!.quantity * out!.unitPrice * 100) - 3050)).toBeLessThanOrEqual(1);
  });

  it('is the identity for the same unit', () => {
    expect(convertLine(4, 450, 'EA', 'each')).toEqual({ quantity: 4, unitPrice: 450 });
  });

  it.each([
    ['cross category (EA -> SQFT)', 4, 450, 'EA', 'SQFT'],
    ['unknown unit', 2, 10, 'Slab', 'SQFT'],
    // 12.5 sqm x $140 = $1750.00; 134.549 sqft x $13.01 drifts by $0.48
    ['amount would drift more than a cent', 12.5, 140, 'SQM', 'SQFT'],
  ])('refuses %s', (_n, qty, price, from, to) => {
    expect(convertLine(qty, price, from, to)).toBeNull();
  });
});
