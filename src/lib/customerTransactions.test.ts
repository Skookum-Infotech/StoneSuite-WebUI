import { describe, it, expect } from 'vitest';
import {
  EMPTY_FILTERS, balanceLabel, dateOrDash, isFiltered, moneyOrDash, parseFilters, statusOptions, writeFilters,
} from './customerTransactions';
import type { CustomerTransactionCount } from '@/types/customerTransactions';

const sp = (s: string) => new URLSearchParams(s);

describe('parseFilters', () => {
  const cases: { name: string; qs: string; want: Partial<typeof EMPTY_FILTERS> }[] = [
    { name: 'empty', qs: '', want: EMPTY_FILTERS },
    { name: 'all fields', qs: 'type=invoice&status=SENT&from=2026-01-01&to=2026-02-01&q=INV&open=1&page=3',
      want: { type: 'invoice', status: 'SENT', from: '2026-01-01', to: '2026-02-01', q: 'INV', open: true, page: 3 } },
    { name: 'page 0 -> 1', qs: 'page=0', want: { page: 1 } },
    { name: 'page junk -> 1', qs: 'page=abc', want: { page: 1 } },
    { name: 'page fractional -> 1', qs: 'page=2.5', want: { page: 1 } },
    { name: 'open other than 1 is off', qs: 'open=true', want: { open: false } },
  ];
  it.each(cases)('$name', ({ qs, want }) => {
    expect(parseFilters(sp(qs))).toEqual({ ...EMPTY_FILTERS, ...want });
  });
});

describe('writeFilters', () => {
  it('round-trips through parseFilters', () => {
    const f = { type: 'invoice', status: 'PAID', from: '2026-01-01', to: '2026-03-01', q: 'X1', open: true, page: 4 };
    expect(parseFilters(writeFilters(sp(''), f))).toEqual(f);
  });

  it('preserves the tab param', () => {
    const out = writeFilters(sp('tab=transactions'), { type: 'invoice' });
    expect(out.get('tab')).toBe('transactions');
    expect(out.get('type')).toBe('invoice');
  });

  it('deletes defaults', () => {
    const out = writeFilters(sp('tab=transactions&type=invoice&open=1&page=2'), { type: '', open: false });
    expect(out.toString()).toBe('tab=transactions');
  });

  it('a filter change clears the page', () => {
    expect(writeFilters(sp('page=5'), { q: 'abc' }).has('page')).toBe(false);
  });

  it('a page change keeps the filters and writes the page', () => {
    const out = writeFilters(sp('type=invoice'), { page: 3 });
    expect(out.get('type')).toBe('invoice');
    expect(out.get('page')).toBe('3');
  });

  it('page 1 is not written', () => {
    expect(writeFilters(sp('page=2'), { page: 1 }).has('page')).toBe(false);
  });

  it('changing the type drops the old status', () => {
    const out = writeFilters(sp('type=invoice&status=PAID'), { type: 'payment' });
    expect(out.has('status')).toBe(false);
  });

  it('setting type and status together keeps both', () => {
    const out = writeFilters(sp(''), { type: 'invoice', status: 'PAID' });
    expect(out.get('status')).toBe('PAID');
  });
});

describe('isFiltered', () => {
  const cases = [
    { name: 'none', f: EMPTY_FILTERS, want: false },
    { name: 'page only', f: { ...EMPTY_FILTERS, page: 4 }, want: false },
    { name: 'blank q', f: { ...EMPTY_FILTERS, q: '  ' }, want: false },
    { name: 'type', f: { ...EMPTY_FILTERS, type: 'invoice' }, want: true },
    { name: 'open', f: { ...EMPTY_FILTERS, open: true }, want: true },
    { name: 'from', f: { ...EMPTY_FILTERS, from: '2026-01-01' }, want: true },
  ];
  it.each(cases)('$name', ({ f, want }) => expect(isFiltered(f)).toBe(want));
});

describe('statusOptions', () => {
  const counts: CustomerTransactionCount[] = [
    { type: 'invoice', count: 3, openCount: 1, statuses: [{ code: 'PAID', label: 'Paid', count: 2 }, { code: 'SENT', label: 'Sent', count: 1 }] },
    { type: 'refund', count: 0, openCount: 0, statuses: [] },
  ];
  it('is empty without a type', () => expect(statusOptions(counts, '')).toEqual([]));
  it('is empty for an unknown type', () => expect(statusOptions(counts, 'quote')).toEqual([]));
  it('lists the type\'s statuses', () => expect(statusOptions(counts, 'invoice').map((s) => s.code)).toEqual(['PAID', 'SENT']));
});

describe('balanceLabel', () => {
  const cases = [
    { type: 'invoice', want: 'Balance due' },
    { type: 'payment', want: 'Unapplied' },
    { type: 'credit_memo', want: 'Unapplied' },
    { type: 'quote', want: '' },
  ];
  it.each(cases)('$type', ({ type, want }) => expect(balanceLabel({ type })).toBe(want));
});

describe('display helpers', () => {
  it('moneyOrDash', () => {
    expect(moneyOrDash(null)).toBe('—');
    expect(moneyOrDash(0)).toContain('0.00');
  });
  it('dateOrDash', () => {
    expect(dateOrDash(null)).toBe('—');
    expect(dateOrDash('2026-10-01')).toContain('2026');
  });
});
