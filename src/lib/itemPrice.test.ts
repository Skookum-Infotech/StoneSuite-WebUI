import { describe, it, expect } from 'vitest';
import { itemPrice } from './itemPrice';

describe('itemPrice', () => {
  const cases = [
    { name: 'selling reads the unit price', item: { unitPrice: 120, purchaseUnitPrice: 80 }, kind: 'selling', want: 120 },
    { name: 'purchasing reads the purchasing price', item: { unitPrice: 120, purchaseUnitPrice: 80 }, kind: 'purchasing', want: 80 },
    { name: 'a purchasing price of 0 is a price, not a gap', item: { unitPrice: 120, purchaseUnitPrice: 0 }, kind: 'purchasing', want: 0 },
    { name: 'purchasing falls back to selling for an API that predates the field', item: { unitPrice: 120 }, kind: 'purchasing', want: 120 },
    { name: 'selling ignores the purchasing price', item: { unitPrice: 0, purchaseUnitPrice: 80 }, kind: 'selling', want: 0 },
  ] as const;

  it.each(cases)('$name', ({ item, kind, want }) => {
    expect(itemPrice(item, kind)).toBe(want);
  });
});
