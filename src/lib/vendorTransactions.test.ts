import { describe, it, expect } from 'vitest';
import {
  EMPTY_FILTERS, balanceLabel, isFiltered, parseFilters, statusOptions, totalCount, writeFilters,
} from './vendorTransactions';
import type { VendorTransactionCount } from '@/types/vendorTransactions';

const counts: VendorTransactionCount[] = [
  { type: 'vendor_bill', count: 5, openCount: 2, statuses: [{ code: 'APPV', label: 'Approved', count: 2 }] },
  { type: 'purchase_order', count: 3, openCount: 1, statuses: [] },
];

describe('parseFilters', () => {
  it('reads every param, leaving defaults empty', () => {
    expect(parseFilters(new URLSearchParams(''))).toEqual(EMPTY_FILTERS);
    expect(
      parseFilters(new URLSearchParams('type=vendor_bill&status=APPV&from=2026-01-01&to=2026-02-01&q=B-1&open=1&cursor=abc')),
    ).toEqual({
      type: 'vendor_bill', status: 'APPV', from: '2026-01-01', to: '2026-02-01', q: 'B-1', open: true, cursor: 'abc',
    });
  });
});

describe('writeFilters', () => {
  it('keeps unrelated params such as tab and deletes defaults', () => {
    const out = writeFilters(new URLSearchParams('tab=transactions&type=vendor_bill'), { type: '' });
    expect(out.toString()).toBe('tab=transactions');
  });

  it('a filter change returns to the first page', () => {
    const out = writeFilters(new URLSearchParams('tab=transactions&cursor=abc'), { open: true });
    expect(out.get('cursor')).toBeNull();
    expect(out.get('open')).toBe('1');
  });

  it('a cursor-only patch keeps filters and sets the cursor verbatim', () => {
    const out = writeFilters(new URLSearchParams('type=vendor_bill&open=1'), { cursor: 'a+b/c==' });
    expect(out.get('cursor')).toBe('a+b/c==');
    expect(out.get('type')).toBe('vendor_bill');
  });

  it('changing the type drops the old type status', () => {
    const out = writeFilters(new URLSearchParams('type=vendor_bill&status=APPV'), { type: 'purchase_order' });
    expect(out.get('status')).toBeNull();
    expect(out.get('type')).toBe('purchase_order');
  });

  it('survives a round trip through a URL string', () => {
    const written = writeFilters(new URLSearchParams('tab=transactions'), {
      type: 'vendor_bill', q: ' B-1 ', from: '2026-01-01', cursor: 'xyz',
    });
    const parsed = parseFilters(new URLSearchParams(written.toString()));
    expect(parsed).toMatchObject({ type: 'vendor_bill', q: ' B-1 ', from: '2026-01-01', cursor: 'xyz' });
  });
});

describe('isFiltered', () => {
  const cases: [string, Partial<typeof EMPTY_FILTERS>, boolean][] = [
    ['nothing', {}, false],
    ['cursor alone is not a filter', { cursor: 'abc' }, false],
    ['blank search is not a filter', { q: '   ' }, false],
    ['open', { open: true }, true],
    ['type', { type: 'vendor_bill' }, true],
    ['date', { from: '2026-01-01' }, true],
  ];
  it.each(cases)('%s', (_n, patch, want) => {
    expect(isFiltered({ ...EMPTY_FILTERS, ...patch })).toBe(want);
  });
});

describe('statusOptions / balanceLabel / totalCount', () => {
  it('status options need a type', () => {
    expect(statusOptions(counts, '')).toEqual([]);
    expect(statusOptions(counts, 'vendor_bill')).toHaveLength(1);
    expect(statusOptions(counts, 'nope')).toEqual([]);
  });
  it('labels the balance by type', () => {
    expect(balanceLabel({ type: 'vendor_bill' })).toBe('Balance due');
    expect(balanceLabel({ type: 'vendor_payment' })).toBe('Unapplied');
    expect(balanceLabel({ type: 'vendor_credit' })).toBe('Unapplied');
    expect(balanceLabel({ type: 'purchase_order' })).toBe('');
  });
  it('sums the counts', () => {
    expect(totalCount(counts)).toBe(8);
    expect(totalCount([])).toBe(0);
  });
});
