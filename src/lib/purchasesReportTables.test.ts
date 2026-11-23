import { describe, it, expect } from 'vitest';
import { formatMoney } from './formatMoney';
import {
  apAgingReportTable,
  describePurchasesWindow,
  formatCostChange,
  formatExpected,
  formatTiming,
  openPoReportTable,
  purchaseItemReportTable,
  vendorReportTable,
} from './purchasesReportTables';
import type { ApAgingReport, PurchasesReportParams } from '@/types/reports';

const PARAMS: PurchasesReportParams = { from: '2026-01-01', to: '2026-01-31' };

describe('formatCostChange', () => {
  it.each([
    [null, '—'],
    [0, '0.0%'],
    [12.5, '+12.5%'],
    [-3, '-3.0%'],
  ])('%s -> %s', (input, want) => {
    expect(formatCostChange(input)).toBe(want);
  });
});

describe('formatTiming', () => {
  it.each([
    ['2026-01-01', -2, 'On time'],
    ['2026-01-01', 0, 'On time'],
    ['2026-01-01', 1, '1 day late'],
    ['2026-01-01', 12, '12 days late'],
    [null, 0, 'No expected date'],
  ])('%s, %d days -> %s', (expected, days, want) => {
    expect(formatTiming(expected, days)).toBe(want);
  });
});

describe('formatExpected', () => {
  it('dashes an order with no expected date', () => {
    expect(formatExpected(null)).toBe('—');
    expect(formatExpected('2026-03-05')).not.toBe('—');
  });
});

describe('describePurchasesWindow', () => {
  it('states the amounts are net of tax and shipping', () => {
    expect(describePurchasesWindow(PARAMS)).toContain('net of tax and shipping');
  });
});

describe('vendorReportTable', () => {
  it('lines up rows and totals with the headers', () => {
    const t = vendorReportTable(
      {
        totals: { poCount: 2, poValue: 300, openPoValue: 100, billCount: 1, billed: 50, balanceOwed: 20 },
        rows: [
          { vendorId: 'v1', name: 'Stone Co', poCount: 2, poValue: 300, avgPoValue: 150, openPoValue: 100, billCount: 1, billed: 50, balanceOwed: 20 },
        ],
      },
      PARAMS,
    );
    expect(t.rows[0]).toEqual(['Stone Co', '2', formatMoney(300), formatMoney(150), formatMoney(100), '1', formatMoney(50), formatMoney(20)]);
    expect(t.totalsRow).toHaveLength(t.headers.length);
  });
});

describe('purchaseItemReportTable', () => {
  it('formats quantity with its unit and the cost change', () => {
    const t = purchaseItemReportTable(
      {
        totals: { spend: 500, items: 1, poCount: 1 },
        rows: [
          { itemId: 'i1', sku: 'G-1', name: 'Granite', quantity: 100.5, unit: 'SQFT', received: 40, poCount: 1, spend: 500, avgCost: 4.97, minCost: 4, maxCost: 6, firstCost: 4, lastCost: 5, costChangePercent: 25 },
        ],
      },
      PARAMS,
    );
    expect(t.rows[0][2]).toBe('100.5 SQFT');
    expect(t.rows[0][8]).toBe('+25.0%');
    expect(t.rows[0]).toHaveLength(t.headers.length);
    expect(t.totalsRow).toHaveLength(t.headers.length);
  });
});

describe('openPoReportTable', () => {
  it('shows timing per order and a late count in the totals', () => {
    const t = openPoReportTable({
      totals: { count: 2, outstanding: 90, overdueCount: 1, overdueValue: 60 },
      rows: [
        { id: 'a', number: 'PORD-1', vendor: 'V', status: 'Sent to Vendor', orderDate: '2026-01-02', expectedDate: '2026-01-05', value: 100, outstanding: 60, receivedPercent: 40, daysOverdue: 3 },
        { id: 'b', number: 'PORD-2', vendor: 'V', status: 'Partially Received', orderDate: '2026-01-03', expectedDate: null, value: 50, outstanding: 30, receivedPercent: 0, daysOverdue: 0 },
      ],
    });
    expect(t.rows.map((r) => r[8])).toEqual(['3 days late', 'No expected date']);
    expect(t.rows[1][4]).toBe('—');
    expect(t.rows[1][8]).toBe('No expected date');
    expect(t.totalsRow?.[8]).toBe('1 late');
    expect(t.rows[0]).toHaveLength(t.headers.length);
  });
});

describe('apAgingReportTable', () => {
  const report: ApAgingReport = {
    labels: ['Current', '1-30 days', '31-60 days'],
    totals: { bills: 3, buckets: [10, 20, 0], total: 30 },
    rows: [{ vendorId: 'v', name: 'Stone Co', bills: 3, buckets: [10, 20, 0], total: 30 }],
  };

  it('builds one column per bucket label between Bills and Total owed', () => {
    const t = apAgingReportTable(report);
    expect(t.headers).toEqual(['Vendor', 'Bills', 'Current', '1-30 days', '31-60 days', 'Total owed']);
    expect(t.rows[0]).toEqual(['Stone Co', '3', formatMoney(10), formatMoney(20), formatMoney(0), formatMoney(30)]);
    expect(t.totalsRow).toHaveLength(t.headers.length);
  });
});
