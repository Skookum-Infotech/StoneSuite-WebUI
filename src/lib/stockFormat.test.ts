import { describe, it, expect } from 'vitest';
import { formatStockQty, isLowStock } from './stockFormat';

describe('formatStockQty', () => {
  it.each([
    [0, '0'],
    [10, '10'],
    [3.5, '3.5'],
    [49.99999, '50'],
    [1234.5678, '1,234.568'],
    [Number.NaN, '0'],
  ])('%s -> %s', (value, want) => {
    expect(formatStockQty(value)).toBe(want);
  });
});

describe('isLowStock', () => {
  it.each([
    ['below the reorder point', 4, 5, true],
    ['exactly at it', 5, 5, true],
    ['above it', 6, 5, false],
    ['no reorder point set', 0, 0, false],
    ['empty with no reorder point set', 0, 0, false],
  ])('%s', (_name, onHand, reorderPoint, want) => {
    expect(isLowStock(onHand, reorderPoint)).toBe(want);
  });
});
