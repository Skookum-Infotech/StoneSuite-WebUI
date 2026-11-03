import { describe, it, expect } from 'vitest';
import {
  MAX_DRAFT_QUANTITY, createLabel, monthName, monthsPhrase, planSummary, plannedTotal, qtyStep,
  splitError, usagePhrase, vendorQuantities, type VendorSplitRow,
} from './replenishment';

const row = (vendorId: string | null, qty: string): VendorSplitRow => ({
  key: `${vendorId}-${qty}`, vendor: vendorId ? { id: vendorId, name: `Vendor ${vendorId}` } : null, qty,
});
const SLABS = { unit: 'slabs' };
const SQFT = { unit: 'SQFT' };
const QTY_ERROR = `Enter a quantity between 1 and ${MAX_DRAFT_QUANTITY} for every vendor.`;

describe('monthName / monthsPhrase', () => {
  it.each([
    ['2026-08', 'Aug'], ['2026-12', 'Dec'], ['2027-01', 'Jan'], ['junk', 'junk'],
  ])('names %s as %s', (input, want) => expect(monthName(input)).toBe(want));

  it.each([
    [[], ''], [['2026-08'], 'Aug'], [['2026-08', '2026-09'], 'Aug and Sep'],
    [['2026-08', '2026-09', '2026-10'], 'Aug, Sep, and Oct'],
  ])('reads %j as "%s"', (months, want) => expect(monthsPhrase(months)).toBe(want));
});

describe('usagePhrase', () => {
  it('lists each month with the serial comma', () => {
    const usage = [{ month: '2026-08', used: 50 }, { month: '2026-09', used: 48 }, { month: '2026-10', used: 50 }];
    expect(usagePhrase({ usage })).toBe('50, 48, and 50');
  });
  it('rounds a fractional bulk figure', () => {
    expect(usagePhrase({ usage: [{ month: '2026-08', used: 10.456 }] })).toBe('10.46');
  });
});

describe('qtyStep', () => {
  it('is whole slabs for a slab item and fractional otherwise', () => {
    expect(qtyStep(SLABS)).toBe('1');
    expect(qtyStep(SQFT)).toBe('0.01');
  });
});

describe('plannedTotal / planSummary', () => {
  it('adds the typed quantities and skips blank or invalid ones', () => {
    expect(plannedTotal([{ qty: '25' }, { qty: '15' }, { qty: '' }, { qty: 'abc' }, { qty: '-3' }])).toBe(40);
  });
  it.each([
    [40, 40, '40 of 40 planned'],
    [40, 25, '25 of 40 planned · 15 still short'],
    [40, 50, '50 of 40 planned · 10 extra'],
    [40, 0, '0 of 40 planned · 40 still short'],
  ])('summarises needed %d / planned %d', (needed, planned, want) => expect(planSummary(needed, planned)).toBe(want));
});

describe('splitError', () => {
  it('accepts a valid split across two vendors', () => {
    expect(splitError(SLABS, [row('a', '25'), row('b', '15')])).toBeNull();
  });
  it.each([
    ['no rows', [], 'Add a vendor.'],
    ['a row with no vendor', [row(null, '5')], 'Choose a vendor for every line.'],
    ['the same vendor twice', [row('a', '5'), row('a', '5')], 'Each vendor can only appear once.'],
    ['a blank quantity', [row('a', '')], QTY_ERROR],
    ['a zero quantity', [row('a', '0')], QTY_ERROR],
    ['a negative quantity', [row('a', '-2')], QTY_ERROR],
    ['an absurd quantity', [row('a', '1e9')], QTY_ERROR],
    ['part of a slab', [row('a', '2.5')], 'Enter a whole number of slabs.'],
  ])('refuses %s', (_name, rows, want) => expect(splitError(SLABS, rows)).toBe(want));

  it('allows a fractional quantity of a bulk item', () => {
    expect(splitError(SQFT, [row('a', '2.5')])).toBeNull();
  });
});

describe('vendorQuantities / createLabel', () => {
  it('turns the rows into the request body', () => {
    expect(vendorQuantities([row('a', '25'), row('b', ' 15 ')])).toEqual([
      { vendorId: 'a', qty: 25 }, { vendorId: 'b', qty: 15 },
    ]);
  });
  it('labels one PO or one per vendor', () => {
    expect(createLabel(1)).toBe('Create PO');
    expect(createLabel(2)).toBe('Create 2 draft POs');
  });
});
