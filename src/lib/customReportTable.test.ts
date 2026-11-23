import { describe, it, expect } from 'vitest';
import { customReportTable } from './customReportTable';
import { formatMoney } from './formatMoney';
import { CUSTOM_EXPORT_ROW_LIMIT } from '@/types/customReports';
import type { CatalogSource, CustomReportDefinition, CustomReportResult } from '@/types/customReports';

const SOURCE: CatalogSource = {
  key: 'invoice_lines',
  label: 'Invoice lines',
  module: 'sales',
  fields: [
    { key: 'customer.name', label: 'Customer name', group: 'Customer', type: 'text' },
    { key: 'net_amount', label: 'Net amount', group: '', type: 'money' },
  ],
};

const GROUPED: CustomReportDefinition = {
  source: 'invoice_lines',
  columns: [],
  filters: [],
  groupBy: { field: 'customer.name' },
  totals: [{ fn: 'sum', field: 'net_amount' }, { fn: 'count' }],
  chart: 'bar',
};

const GROUPED_RESULT: CustomReportResult = {
  columns: [
    { key: 'group', label: 'Customer name', type: 'text' },
    { key: 'total:0', label: 'Sum of Net amount', type: 'money' },
    { key: 'total:1', label: 'Count', type: 'number' },
  ],
  rows: [
    ['Acme', 1500, 3],
    ['(blank)', null, 1],
  ],
  totals: [null, 1500, 4],
  rowCount: 4,
  truncated: false,
};

describe('customReportTable', () => {
  it('turns a grouped result into headers, formatted rows and a labelled totals row', () => {
    const t = customReportTable('Revenue by customer', GROUPED, SOURCE, GROUPED_RESULT);
    expect(t.title).toBe('Revenue by customer');
    expect(t.headers).toEqual(['Customer name', 'Sum of Net amount', 'Count']);
    expect(t.rows).toEqual([
      ['Acme', formatMoney(1500), '3'],
      ['(blank)', '—', '1'],
    ]);
    expect(t.totalsRow).toEqual(['Total', formatMoney(1500), '4']);
    expect(t.subtitle).toBe('Invoice lines grouped by Customer name · Sum of Net amount, Count');
  });

  it('puts the Total label in the first column that has no total of its own', () => {
    const list: CustomReportDefinition = { source: 'invoice_lines', columns: ['net_amount', 'customer.name'], filters: [], totals: [], chart: 'none' };
    const result: CustomReportResult = {
      columns: [
        { key: 'net_amount', label: 'Net amount', type: 'money' },
        { key: 'customer.name', label: 'Customer name', type: 'text' },
      ],
      rows: [[10, 'Acme']],
      totals: [10, null],
      rowCount: 1,
      truncated: false,
    };
    const t = customReportTable('List', list, SOURCE, result);
    expect(t.totalsRow).toEqual([formatMoney(10), 'Total']);
  });

  it('leaves the totals row out when no column has a total', () => {
    const list: CustomReportDefinition = { source: 'invoice_lines', columns: ['customer.name'], filters: [], totals: [], chart: 'none' };
    const result: CustomReportResult = {
      columns: [{ key: 'customer.name', label: 'Customer name', type: 'text' }],
      rows: [['Acme']],
      totals: [null],
      rowCount: 1,
      truncated: false,
    };
    expect(customReportTable('List', list, SOURCE, result).totalsRow).toBeUndefined();
  });

  it('says so in the subtitle when the export was cut at the row limit', () => {
    const t = customReportTable('Revenue', GROUPED, SOURCE, { ...GROUPED_RESULT, truncated: true });
    expect(t.subtitle).toContain(`first ${CUSTOM_EXPORT_ROW_LIMIT.toLocaleString()} rows`);
  });

  it('gives every row a cell per header', () => {
    const t = customReportTable('Revenue', GROUPED, SOURCE, GROUPED_RESULT);
    for (const row of [...t.rows, t.totalsRow ?? []]) expect(row).toHaveLength(t.headers.length);
  });
});
