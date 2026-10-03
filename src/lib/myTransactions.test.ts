import { describe, it, expect } from 'vitest';
import {
  buildPageItems,
  formatAmount,
  groupTypesByDomain,
  pageCount,
  pageRange,
  rowHeadline,
  rowHref,
  rowSubline,
  statusTone,
} from './myTransactions';
import type { TransactionType } from '@/types/myTransactions';

describe('statusTone', () => {
  it.each([
    ['APPV', 'success'],
    ['PAID', 'success'],
    ['available', 'success'],
    ['PAPV', 'warning'],
    ['PART', 'warning'],
    ['ODUE', 'danger'],
    ['RJCT', 'danger'],
    ['SENT', 'info'],
    ['DRFT', 'muted'],
    ['CANC', 'muted'],
    ['scrapped', 'muted'],
  ])('maps %s to %s', (code, tone) => {
    expect(statusTone(code)).toBe(tone);
  });

  it('degrades an unknown or empty code to neutral instead of throwing', () => {
    expect(statusTone('ZZZZ')).toBe('muted');
    expect(statusTone('')).toBe('muted');
  });
});

describe('groupTypesByDomain', () => {
  const types: TransactionType[] = [
    { type: 'vendor_bill', label: 'Vendor Bill', domain: 'purchases' },
    { type: 'quote', label: 'Quote', domain: 'sales' },
    { type: 'lead', label: 'Lead', domain: 'crm' },
    { type: 'invoice', label: 'Invoice', domain: 'sales' },
    { type: 'widget', label: 'Widget', domain: 'mystery' },
    { type: 'chart_of_account', label: 'Account', domain: 'finance' },
  ];

  it('orders domains CRM → Sales → Purchases → Inventory → Finance, unknown ones last', () => {
    expect(groupTypesByDomain(types).map((g) => g.domain)).toEqual([
      'crm', 'sales', 'purchases', 'finance', 'mystery',
    ]);
  });

  it('sorts types alphabetically within a domain and labels the group', () => {
    const sales = groupTypesByDomain(types).find((g) => g.domain === 'sales');
    expect(sales?.label).toBe('Sales');
    expect(sales?.types.map((t) => t.label)).toEqual(['Invoice', 'Quote']);
  });

  it('keeps an unrecognised domain under its raw name rather than dropping it', () => {
    const mystery = groupTypesByDomain(types).find((g) => g.domain === 'mystery');
    expect(mystery?.label).toBe('mystery');
    expect(mystery?.types).toHaveLength(1);
  });

  it('returns no groups for no types', () => {
    expect(groupTypesByDomain([])).toEqual([]);
  });
});

describe('pageCount', () => {
  it.each([
    [0, 25, 1],
    [1, 25, 1],
    [25, 25, 1],
    [26, 25, 2],
    [100, 10, 10],
    [101, 10, 11],
  ])('%i rows at %i per page make %i page(s)', (total, size, want) => {
    expect(pageCount(total, size)).toBe(want);
  });

  it('never returns less than one page, even for nonsense input', () => {
    expect(pageCount(-5, 25)).toBe(1);
    expect(pageCount(10, 0)).toBe(1);
  });
});

describe('pageRange', () => {
  it.each([
    [1, 25, 132, { from: 1, to: 25 }],
    [2, 25, 132, { from: 26, to: 50 }],
    [6, 25, 132, { from: 126, to: 132 }], // short last page
    [1, 25, 7, { from: 1, to: 7 }],
    [1, 25, 0, { from: 0, to: 0 }],
  ])('page %i at %i per page of %i rows', (page, size, total, want) => {
    expect(pageRange(page, size, total)).toEqual(want);
  });
});

describe('buildPageItems', () => {
  it('lists every page when they fit the strip', () => {
    expect(buildPageItems(1, 1)).toEqual([1]);
    expect(buildPageItems(3, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(buildPageItems(4, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('collapses the far end behind an ellipsis near the start', () => {
    expect(buildPageItems(1, 20)).toEqual([1, 2, 3, 4, 5, 'ellipsis-end', 20]);
    expect(buildPageItems(4, 20)).toEqual([1, 2, 3, 4, 5, 'ellipsis-end', 20]);
  });

  it('collapses the near end behind an ellipsis near the finish', () => {
    expect(buildPageItems(20, 20)).toEqual([1, 'ellipsis-start', 16, 17, 18, 19, 20]);
    expect(buildPageItems(17, 20)).toEqual([1, 'ellipsis-start', 16, 17, 18, 19, 20]);
  });

  it('shows the current page and its neighbours with a gap either side in the middle', () => {
    expect(buildPageItems(10, 20)).toEqual([1, 'ellipsis-start', 9, 10, 11, 'ellipsis-end', 20]);
    expect(buildPageItems(5, 9)).toEqual([1, 'ellipsis-start', 4, 5, 6, 'ellipsis-end', 9]);
  });

  it('always fills the same number of slots once there are more than seven pages', () => {
    for (let count = 8; count <= 40; count++) {
      for (let current = 1; current <= count; current++) {
        const items = buildPageItems(current, count);
        expect(items, `page ${current} of ${count}`).toHaveLength(7);
        expect(items, `page ${current} of ${count}`).toContain(current);
        expect(items[0]).toBe(1);
        expect(items[items.length - 1]).toBe(count);
      }
    }
  });
});

describe('formatAmount', () => {
  it('formats a total as currency', () => {
    expect(formatAmount(28400)).toBe('$28,400.00');
  });

  it('shows a dash, not $0.00, when the record type has no total', () => {
    expect(formatAmount(null)).toBe('—');
  });

  it('still formats a genuine zero', () => {
    expect(formatAmount(0)).toBe('$0.00');
  });
});

describe('row text helpers', () => {
  it('links to the detail page from the backend-supplied route segments', () => {
    expect(rowHref({ domain: 'sales', module: 'installation', id: 'abc' })).toBe('/sales/installation/abc');
  });

  it('headlines the reference, falling back to the title, then a dash', () => {
    expect(rowHeadline({ number: 'INV-1', name: 'Acme' })).toBe('INV-1');
    expect(rowHeadline({ number: '', name: 'Acme Corp' })).toBe('Acme Corp');
    expect(rowHeadline({ number: '', name: '' })).toBe('—');
  });

  it('shows the title as a second line only when the reference is the headline', () => {
    expect(rowSubline({ number: 'LEAD-1', name: 'Whitmore Residence' })).toBe('Whitmore Residence');
    expect(rowSubline({ number: '', name: 'Acme Corp' })).toBe('');
    expect(rowSubline({ number: 'INV-1', name: '' })).toBe('');
  });
});
