import { describe, it, expect } from 'vitest';
import {
  INVOICE_SORT_FIELDS, isInvoiceViewState, sameInvoiceView, type InvoiceViewState,
} from './invoiceSavedViews';

const base: InvoiceViewState = { term: 'INV-1', sortBy: 'balanceDue', sortDir: 'desc' };

describe('isInvoiceViewState', () => {
  it.each(INVOICE_SORT_FIELDS)('accepts sorting by %s in either direction', (sortBy) => {
    expect(isInvoiceViewState({ term: '', sortBy, sortDir: 'asc' })).toBe(true);
    expect(isInvoiceViewState({ term: 'x', sortBy, sortDir: 'desc' })).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'balanceDue'],
    ['an array', []],
    ['an empty object', {}],
    ['a numeric term', { ...base, term: 5 }],
    ['a missing term', { sortBy: 'createdAt', sortDir: 'asc' }],
    ['a sort field the list does not have', { ...base, sortBy: 'customerName' }],
    ['a non-string sort field', { ...base, sortBy: 3 }],
    ['an unknown direction', { ...base, sortDir: 'up' }],
    ['a missing direction', { term: '', sortBy: 'createdAt' }],
  ])('rejects %s', (_name, value) => {
    expect(isInvoiceViewState(value)).toBe(false);
  });

  it('ignores extra keys rather than failing on them', () => {
    expect(isInvoiceViewState({ ...base, columns: ['a'] })).toBe(true);
  });
});

describe('sameInvoiceView', () => {
  it.each([
    ['identical views', base, true],
    ['a search that differs only by padding', { ...base, term: '  INV-1 ' }, true],
    ['a different search', { ...base, term: 'INV-2' }, false],
    ['a different sort field', { ...base, sortBy: 'grandTotal' }, false],
    ['a different direction', { ...base, sortDir: 'asc' }, false],
  ] as const)('%s', (_name, other, want) => {
    expect(sameInvoiceView(base, other as InvoiceViewState)).toBe(want);
  });
});
