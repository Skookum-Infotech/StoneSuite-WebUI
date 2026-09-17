import { describe, expect, it } from 'vitest';
import {
  placementFromSelection, placementLabel, placementOf, placementPayload,
  requiresExplicitSide, sideForPlacement, type Placement,
} from './coaPlacement';
import type { Category, SubCategory } from '@/types/chartOfAccounts';

const categories: Category[] = [
  { id: 1, code: 1000, name: 'Assets', rangeLow: 1000, rangeHigh: 1999, normalBalance: 'debit', bsPnl: 'BS', sortOrder: 1 },
  { id: 4, code: 4000, name: 'Revenue', rangeLow: 4000, rangeHigh: 4999, normalBalance: 'credit', bsPnl: 'PNL', sortOrder: 4 },
  { id: 9, code: 9000, name: 'System & Control Accounts', rangeLow: 9000, rangeHigh: 9999, normalBalance: 'debit', bsPnl: 'MIXED', sortOrder: 9 },
];

const subCategories: SubCategory[] = [
  { id: 1, categoryId: 1, categoryCode: 1000, code: 1100, name: 'Current Assets', rangeLow: 1100, rangeHigh: 1199, sortOrder: 1 },
  { id: 7, categoryId: 4, categoryCode: 4000, code: 4100, name: 'Sales', rangeLow: 4100, rangeHigh: 4199, sortOrder: 1 },
  { id: 17, categoryId: 9, categoryCode: 9000, code: 9100, name: 'System & Control Accounts', rangeLow: 9100, rangeHigh: 9199, sortOrder: 1 },
];

describe('placementFromSelection', () => {
  const cases: [string, number | null, number | null, Placement | null][] = [
    ['nothing picked', null, null, null],
    ['category only', 4, null, { kind: 'category', id: 4 }],
    ['category and sub-category', 1, 7, { kind: 'subcategory', id: 7 }],
    // A sub-category without a category shouldn't happen from the UI (the
    // sub-category dropdown is empty until a category is picked), but the
    // function must still have a defined answer: no category, no placement.
    ['sub-category without a category', null, 7, null],
  ];

  it.each(cases)('%s', (_name, categoryId, subCategoryId, want) => {
    expect(placementFromSelection(categoryId, subCategoryId)).toEqual(want);
  });
});

describe('placementPayload', () => {
  it('sends only categoryId for a category placement', () => {
    expect(placementPayload({ kind: 'category', id: 4 })).toEqual({ categoryId: 4 });
  });

  it('sends only subCategoryId for a sub-category placement', () => {
    expect(placementPayload({ kind: 'subcategory', id: 7 })).toEqual({ subCategoryId: 7 });
  });
});

describe('sideForPlacement', () => {
  const cases: [string, Placement | null, string | undefined][] = [
    ['a BS category', { kind: 'category', id: 1 }, 'BS'],
    ['a PNL category', { kind: 'category', id: 4 }, 'PNL'],
    ['a MIXED category', { kind: 'category', id: 9 }, 'MIXED'],
    // A sub-category has no side of its own — it resolves through its parent.
    ['a sub-category of a BS category', { kind: 'subcategory', id: 1 }, 'BS'],
    ['a sub-category of a PNL category', { kind: 'subcategory', id: 7 }, 'PNL'],
    ['a sub-category of a MIXED category', { kind: 'subcategory', id: 17 }, 'MIXED'],
    ['no placement', null, undefined],
    ['an unknown category', { kind: 'category', id: 404 }, undefined],
    ['an unknown sub-category', { kind: 'subcategory', id: 404 }, undefined],
  ];

  it.each(cases)('resolves %s', (_name, placement, want) => {
    expect(sideForPlacement(placement, categories, subCategories)).toBe(want);
  });

  // While the reference tree is still loading there is nothing to resolve
  // against; that must not read as a definite side.
  it('returns undefined before the reference tree loads', () => {
    expect(sideForPlacement({ kind: 'category', id: 1 }, [], [])).toBeUndefined();
  });
});

describe('requiresExplicitSide', () => {
  it.each([
    ['MIXED', 'MIXED' as const, true],
    ['BS', 'BS' as const, false],
    ['PNL', 'PNL' as const, false],
    ['unresolved', undefined, false],
  ])('%s', (_name, side, want) => {
    expect(requiresExplicitSide(side)).toBe(want);
  });
});

describe('placementOf', () => {
  it('prefers the sub-category when one is set', () => {
    expect(placementOf({ subCategoryId: 1, categoryId: 1 })).toEqual({ kind: 'subcategory', id: 1 });
  });

  it('falls back to the category for a category-placed account', () => {
    expect(placementOf({ subCategoryId: undefined, categoryId: 4 })).toEqual({ kind: 'category', id: 4 });
  });
});

describe('placementLabel', () => {
  it('names the sub-category when the account has one', () => {
    expect(placementLabel({
      subCategoryCode: 1100, subCategoryName: 'Current Assets',
      categoryCode: 1000, categoryName: 'Assets',
    })).toBe('1100 — Current Assets');
  });

  it('names the category for a category-placed account', () => {
    expect(placementLabel({
      subCategoryCode: undefined, subCategoryName: undefined,
      categoryCode: 1000, categoryName: 'Assets',
    })).toBe('1000 — Assets');
  });
});
