import { describe, it, expect } from 'vitest';
import { formatMoney } from './formatMoney';
import { customerReportTable, describeSalesWindow, itemReportTable, trendReportTable } from './salesReportTables';
import type { SalesReport, SalesCustomerRow, SalesItemRow, SalesReportParams, SalesTrendRow } from '@/types/reports';

const PARAMS: SalesReportParams = { basis: 'invoices', from: '2026-01-01', to: '2026-01-31' };
const TOTALS = { revenue: 1000, cost: 600, margin: 400, marginPercent: 40, records: 5 };

describe('describeSalesWindow', () => {
  it('names the basis and says amounts are net of tax and shipping', () => {
    const text = describeSalesWindow(PARAMS);
    expect(text).toContain('Invoices');
    expect(text).toContain('net of tax and shipping');
    expect(describeSalesWindow({ ...PARAMS, basis: 'orders' })).toContain('Sales orders');
  });
});

describe('customerReportTable', () => {
  const report: SalesReport<SalesCustomerRow> = {
    basis: 'invoices',
    totals: TOTALS,
    rows: [
      { customerId: 'c1', name: 'Acme', records: 2, revenue: 800, cost: 500, margin: 300, avgValue: 400, lastDate: null },
      { customerId: 'c2', name: 'Zero Rev', records: 1, revenue: 0, cost: 10, margin: -10, avgValue: 0, lastDate: null },
    ],
  };

  it('has one column per header in every row and in the totals row', () => {
    const t = customerReportTable(report, PARAMS);
    for (const row of [...t.rows, t.totalsRow ?? []]) expect(row).toHaveLength(t.headers.length);
  });

  it('formats money, shows margin percent, and dashes the percent when revenue is zero', () => {
    const t = customerReportTable(report, PARAMS);
    expect(t.rows[0].slice(0, 6)).toEqual(['Acme', '2', formatMoney(800), formatMoney(500), formatMoney(300), '37.5%']);
    expect(t.rows[1][5]).toBe('—');
    expect(t.rows[0][7]).toBe('—'); // no last date
    expect(t.totalsRow?.[0]).toBe('Total');
  });
});

describe('itemReportTable', () => {
  it('lines up headers, rows and totals', () => {
    const rows: SalesItemRow[] = [
      { itemId: 'i1', sku: 'SKU-1', name: 'Calacatta', quantity: 12.5, unit: 'sqft', records: 2, revenue: 500, cost: 200, margin: 300, avgPrice: 40 },
    ];
    const t = itemReportTable({ basis: 'invoices', totals: TOTALS, rows }, PARAMS);
    expect(t.rows[0]).toHaveLength(t.headers.length);
    expect(t.totalsRow).toHaveLength(t.headers.length);
    expect(t.rows[0][2]).toBe('12.5');
  });
});

describe('trendReportTable', () => {
  const rows: SalesTrendRow[] = [{ period: '2026-01-01', records: 3, revenue: 300, cost: 100, margin: 200 }];

  it.each([
    ['month', 'Month'],
    ['week', 'Week'],
  ] as const)('labels the first column for a %s bucket', (bucket, header) => {
    const t = trendReportTable({ basis: 'orders', totals: TOTALS, rows }, { ...PARAMS, basis: 'orders' }, bucket);
    expect(t.headers[0]).toBe(header);
    expect(t.headers[1]).toBe('Sales orders');
    expect(t.rows[0]).toHaveLength(t.headers.length);
  });
});
