import { describe, it, expect } from 'vitest';
import { buildReportCsv, buildReportFilename, type ReportTable } from './reportExport';
import { numericColumns } from './reportsPdfExport';

const TABLE: ReportTable = {
  title: 'Sales by Customer',
  subtitle: 'Invoices',
  headers: ['Customer', 'Invoices', 'Revenue', 'Last date'],
  rows: [
    ['Acme, Inc.', '3', '$1,200.00', 'Jan 5, 2026'],
    ['Beta "Co"', '1', '$300.00', '—'],
  ],
  totalsRow: ['Total', '4', '$1,500.00', ''],
};

describe('buildReportFilename', () => {
  it.each([
    ['Sales by Customer', '2026-11-06', 'sales-by-customer-2026-11-06'],
    ['  Profit & Loss  ', '2026-11-06', 'profit-loss-2026-11-06'],
  ])('%s', (title, day, want) => {
    expect(buildReportFilename(title, new Date(`${day}T12:00:00Z`))).toBe(want);
  });
});

describe('buildReportCsv', () => {
  it('writes headers, rows and the totals row, quoting commas and quotes', () => {
    expect(buildReportCsv(TABLE).split('\r\n')).toEqual([
      'Customer,Invoices,Revenue,Last date',
      '"Acme, Inc.",3,"$1,200.00","Jan 5, 2026"',
      '"Beta ""Co""",1,$300.00,—',
      'Total,4,"$1,500.00",',
    ]);
  });

  it('omits the totals row when the report has none', () => {
    const { totalsRow: _unused, ...withoutTotals } = TABLE;
    expect(buildReportCsv(withoutTotals).split('\r\n')).toHaveLength(3);
  });
});

describe('numericColumns', () => {
  it('right-aligns count and amount columns but never the first or a date column', () => {
    expect(numericColumns(TABLE)).toEqual([1, 2]);
  });

  it('ignores empty and dash cells when judging a column', () => {
    const t: ReportTable = {
      title: 't',
      subtitle: '',
      headers: ['A', 'B'],
      rows: [['x', '—'], ['y', '12']],
    };
    expect(numericColumns(t)).toEqual([1]);
  });
});
