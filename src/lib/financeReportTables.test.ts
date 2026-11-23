import { describe, it, expect } from 'vitest';
import { formatMoney } from './formatMoney';
import { accountLabel, isEmptyProfitLoss, profitLossReportTable } from './financeReportTables';
import type { ProfitLoss } from '@/types/reports';

const WINDOW = { from: '2026-01-01', to: '2026-01-31' };

const PL: ProfitLoss = {
  income: 1450,
  expenses: 900,
  grossProfit: 800,
  netProfit: 550,
  netMarginPercent: 37.93,
  sections: [
    {
      code: 4000, name: 'Revenue', kind: 'income', total: 1400,
      subcategories: [
        { name: 'Sales', total: 1500, accounts: [{ id: 'a1', code: '4101', name: 'Product Sales', amount: 1500 }] },
        { name: 'Returns', total: -100, accounts: [{ id: 'a2', code: '4201', name: 'Sales Returns', amount: -100 }] },
      ],
    },
    {
      code: 5000, name: 'Cost of Goods Sold', kind: 'expense', total: 600,
      subcategories: [{ name: 'COGS', total: 600, accounts: [{ id: 'a3', code: '5101', name: 'Purchases', amount: 600 }] }],
    },
  ],
};

describe('accountLabel', () => {
  it.each([
    ['4101', 'Product Sales', '4101 · Product Sales'],
    ['', 'Unnamed', 'Unnamed'],
  ])('%s %s -> %s', (code, name, want) => {
    expect(accountLabel(code, name)).toBe(want);
  });
});

describe('isEmptyProfitLoss', () => {
  it('is empty only when there are no sections', () => {
    expect(isEmptyProfitLoss({ ...PL, sections: [] })).toBe(true);
    expect(isEmptyProfitLoss(PL)).toBe(false);
  });
});

describe('profitLossReportTable', () => {
  const t = profitLossReportTable(PL, WINDOW);

  it('has a row per account, a total per section and a Gross profit row', () => {
    expect(t.rows).toHaveLength(3 + 2 + 1);
    expect(t.rows[0]).toEqual(['Revenue', 'Sales', '4101 · Product Sales', formatMoney(1500)]);
    expect(t.rows[1]).toEqual(['Revenue', 'Returns', '4201 · Sales Returns', formatMoney(-100)]);
    expect(t.rows[2]).toEqual(['Total Revenue', '', '', formatMoney(1400)]);
    expect(t.rows.at(-1)).toEqual(['Gross profit', '', '', formatMoney(800)]);
  });

  it('ends with Net profit as the totals row and gives every row a cell per header', () => {
    expect(t.totalsRow).toEqual(['Net profit', '', '', formatMoney(550)]);
    for (const row of [...t.rows, t.totalsRow ?? []]) expect(row).toHaveLength(t.headers.length);
  });

  it('puts the net margin and the sign convention in the subtitle', () => {
    expect(t.subtitle).toContain('37.9%');
    expect(t.subtitle).toContain('credit less debit');
  });
});
