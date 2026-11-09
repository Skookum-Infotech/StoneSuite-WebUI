import { describe, it, expect } from 'vitest';
import {
  describeDefinition,
  emptyDefinition,
  filterDefaults,
  formatCell,
  isCompleteFilter,
  newFilterRule,
  operatorsFor,
  promptByteLength,
  pruneUnknownFields,
  resolveDateFilters,
  runnableDefinition,
  saveableDefinition,
  totalLabel,
} from './customReportDefinition';
import { formatMoney } from './formatMoney';
import type { CatalogSource, CustomFilterRule, CustomReportDefinition } from '@/types/customReports';

const SOURCE: CatalogSource = {
  key: 'invoice_lines',
  label: 'Invoice lines',
  module: 'sales',
  fields: [
    { key: 'item_name', label: 'Line item name', group: '', type: 'text' },
    { key: 'sku', label: 'Line SKU', group: '', type: 'text' },
    { key: 'unit_code', label: 'Line unit', group: '', type: 'text' },
    { key: 'net_amount', label: 'Net amount', group: '', type: 'money' },
    { key: 'customer.name', label: 'Customer name', group: 'Customer', type: 'text' },
    { key: 'invoice.date', label: 'Invoice date', group: 'Invoice', type: 'date' },
    { key: 'invoice.status', label: 'Invoice status', group: 'Invoice', type: 'status', options: ['Paid', 'Sent'] },
  ],
};

const GROUPED: CustomReportDefinition = {
  source: 'invoice_lines',
  columns: [],
  filters: [],
  groupBy: { field: 'customer.name' },
  totals: [{ fn: 'sum', field: 'net_amount' }],
  chart: 'bar',
};

describe('emptyDefinition', () => {
  it('starts with the first three of the source’s own fields and no chart', () => {
    expect(emptyDefinition(SOURCE)).toEqual({
      source: 'invoice_lines',
      columns: ['item_name', 'sku', 'unit_code'],
      filters: [],
      totals: [],
      chart: 'none',
    });
  });
});

describe('operatorsFor', () => {
  it.each([
    ['text', ['eq', 'neq', 'contains', 'in', 'is_empty']],
    ['number', ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_empty']],
    ['money', ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'between', 'is_empty']],
    ['date', ['date_range', 'is_empty']],
    ['status', ['in']],
  ] as const)('%s', (type, want) => {
    expect(operatorsFor(type)).toEqual(want);
  });
});

describe('resolveDateFilters', () => {
  const now = new Date(2026, 10, 6);

  it('turns a relative preset into the window it means today', () => {
    const def: CustomReportDefinition = {
      ...GROUPED,
      filters: [{ field: 'invoice.date', op: 'date_range', values: ['2020-01-01', '2020-01-31'], preset: 'this-quarter' }],
    };
    expect(resolveDateFilters(def, now).filters[0].values).toEqual(['2026-10-01', '2026-11-06']);
  });

  it('keeps a custom range and non-date filters as they are, and does not mutate its input', () => {
    const custom: CustomFilterRule = { field: 'invoice.date', op: 'date_range', values: ['2026-01-01', '2026-01-31'], preset: 'custom' };
    const text: CustomFilterRule = { field: 'customer.name', op: 'contains', values: ['acme'] };
    const def: CustomReportDefinition = { ...GROUPED, filters: [{ ...custom }, { ...text }] };
    const out = resolveDateFilters(def, now);
    expect(out.filters).toEqual([custom, text]);
    expect(def.filters[0].values).toEqual(['2026-01-01', '2026-01-31']);
  });
});

describe('pruneUnknownFields', () => {
  it('removes anything the catalog no longer has and reports what it removed', () => {
    const def: CustomReportDefinition = {
      source: 'invoice_lines',
      columns: ['item_name', 'nope'],
      filters: [{ field: 'ghost', op: 'eq', values: ['x'] }, { field: 'sku', op: 'eq', values: ['a'] }],
      totals: [{ fn: 'sum', field: 'gone' }, { fn: 'count' }],
      sort: { key: 'nope', desc: false },
      chart: 'none',
    };
    const { definition, removed } = pruneUnknownFields(def, SOURCE);
    expect(definition.columns).toEqual(['item_name']);
    expect(definition.filters).toEqual([{ field: 'sku', op: 'eq', values: ['a'] }]);
    expect(definition.totals).toEqual([{ fn: 'count' }]);
    expect(definition.sort).toBeUndefined();
    expect(removed).toEqual(['nope', 'ghost', 'gone']);
  });

  it('drops a group-by on a missing field, and the bar chart with it', () => {
    const def: CustomReportDefinition = { ...GROUPED, groupBy: { field: 'ghost' } };
    const { definition, removed } = pruneUnknownFields(def, SOURCE);
    expect(definition.groupBy).toBeUndefined();
    expect(definition.chart).toBe('none');
    expect(removed).toEqual(['ghost']);
  });

  it('drops a sort on a total that no longer exists', () => {
    const def: CustomReportDefinition = {
      ...GROUPED,
      totals: [{ fn: 'sum', field: 'gone' }],
      sort: { key: 'total:0', desc: true },
    };
    const { definition } = pruneUnknownFields(def, SOURCE);
    expect(definition.totals).toEqual([]);
    expect(definition.sort).toBeUndefined();
    expect(definition.chart).toBe('none');
  });

  it('changes nothing in a definition that is already fine', () => {
    const { definition, removed } = pruneUnknownFields(GROUPED, SOURCE);
    expect(definition).toEqual(GROUPED);
    expect(removed).toEqual([]);
  });
});

describe('describeDefinition', () => {
  it('names the group and the totals', () => {
    expect(describeDefinition(GROUPED, SOURCE)).toBe('Invoice lines grouped by Customer name · Sum of Net amount');
  });

  it('names a date bucket, a count and a top N', () => {
    const def: CustomReportDefinition = {
      ...GROUPED,
      groupBy: { field: 'invoice.date', dateBucket: 'month' },
      totals: [{ fn: 'count' }],
      topN: 10,
    };
    expect(describeDefinition(def, SOURCE)).toBe('Invoice lines grouped by Invoice date (month) · Count · top 10');
  });

  it('counts columns and filters for a list', () => {
    const def: CustomReportDefinition = {
      source: 'invoice_lines',
      columns: ['item_name', 'sku'],
      filters: [{ field: 'sku', op: 'eq', values: ['a'] }],
      totals: [],
      chart: 'none',
    };
    expect(describeDefinition(def, SOURCE)).toBe('Invoice lines · 2 columns · 1 filter');
  });
});

describe('formatCell', () => {
  it.each([
    [null, 'text', '—'],
    ['Acme', 'text', 'Acme'],
    ['(blank)', 'text', '(blank)'],
    [1500.5, 'money', formatMoney(1500.5)],
    [1234.5678, 'number', '1,234.5678'],
    [42, 'number', '42'],
    ['2026-11-06', 'date', '2026-11-06'],
    ['Paid', 'status', 'Paid'],
  ] as const)('%s as %s', (value, type, want) => {
    expect(formatCell(value, type)).toBe(want);
  });
});

describe('promptByteLength', () => {
  it('counts bytes, not characters', () => {
    expect(promptByteLength('abc')).toBe(3);
    expect(promptByteLength('é')).toBe(2);
    expect(promptByteLength('')).toBe(0);
  });
});

describe('isCompleteFilter', () => {
  it.each([
    [{ field: 'sku', op: 'eq', values: ['a'] }, 'text', true],
    [{ field: 'sku', op: 'eq', values: [''] }, 'text', false],
    [{ field: 'sku', op: 'eq', values: [] }, 'text', false],
    [{ field: 'sku', op: 'in', values: ['a', 'b'] }, 'text', true],
    [{ field: 'sku', op: 'in', values: [] }, 'text', false],
    [{ field: 'sku', op: 'is_empty', values: [] }, 'text', true],
    [{ field: 'net_amount', op: 'gt', values: ['1,000'] }, 'money', true],
    [{ field: 'net_amount', op: 'gt', values: ['abc'] }, 'money', false],
    [{ field: 'net_amount', op: 'gt', values: ['0x10'] }, 'money', false],
    [{ field: 'net_amount', op: 'gt', values: ['1e3'] }, 'money', true],
    [{ field: 'net_amount', op: 'between', values: ['1', '9'] }, 'money', true],
    [{ field: 'net_amount', op: 'between', values: ['1', ''] }, 'money', false],
    [{ field: 'invoice.date', op: 'date_range', values: ['2026-01-01', '2026-01-31'] }, 'date', true],
    [{ field: 'invoice.date', op: 'date_range', values: ['2026-02-01', '2026-01-31'] }, 'date', false],
    [{ field: 'invoice.date', op: 'date_range', values: ['2026-01-01'] }, 'date', false],
    [{ field: 'invoice.status', op: 'in', values: ['Paid'] }, 'status', true],
  ] as const)('%j (%s) -> %s', (rule, type, want) => {
    expect(isCompleteFilter({ ...rule, values: [...rule.values] }, type)).toBe(want);
  });
});

describe('runnableDefinition', () => {
  const now = new Date(2026, 10, 6);
  const LIST: CustomReportDefinition = { source: 'invoice_lines', columns: ['item_name'], filters: [], totals: [], chart: 'none' };

  it('drops half-filled filters, resolves date presets and strips thousands separators', () => {
    const def: CustomReportDefinition = {
      ...LIST,
      filters: [
        { field: 'sku', op: 'eq', values: [''] },
        { field: 'invoice.date', op: 'date_range', values: [], preset: 'this-quarter' },
        { field: 'net_amount', op: 'gt', values: [' 1,000 '] },
        { field: 'ghost', op: 'eq', values: ['x'] },
      ],
    };
    expect(runnableDefinition(def, SOURCE, now)?.filters).toEqual([
      { field: 'invoice.date', op: 'date_range', values: ['2026-10-01', '2026-11-06'], preset: 'this-quarter' },
      { field: 'net_amount', op: 'gt', values: ['1000'] },
    ]);
  });

  it('is null until a list has a column or a grouped report has a total', () => {
    expect(runnableDefinition({ ...LIST, columns: [] }, SOURCE, now)).toBeNull();
    expect(runnableDefinition({ ...GROUPED, totals: [] }, SOURCE, now)).toBeNull();
    expect(runnableDefinition({ ...GROUPED, totals: [{ fn: 'sum' }] }, SOURCE, now)).toBeNull();
    expect(runnableDefinition(GROUPED, SOURCE, now)).not.toBeNull();
    expect(runnableDefinition(LIST, SOURCE, now)).not.toBeNull();
  });
});

describe('filterDefaults / newFilterRule', () => {
  it.each([
    ['eq', 'text', { values: [''] }],
    ['contains', 'text', { values: [''] }],
    ['in', 'text', { values: [] }],
    ['in', 'status', { values: [] }],
    ['is_empty', 'text', { values: [] }],
    ['gt', 'money', { values: [''] }],
    ['between', 'money', { values: ['', ''] }],
    ['date_range', 'date', { values: [], preset: 'this-quarter' }],
  ] as const)('%s on %s starts as %j', (op, _type, want) => {
    expect(filterDefaults(op)).toEqual(want);
  });

  it('a new filter starts on the field’s first comparison with nothing filled in', () => {
    expect(newFilterRule({ key: 'sku', label: 'Line SKU', group: '', type: 'text' })).toEqual({ field: 'sku', op: 'eq', values: [''] });
    expect(newFilterRule({ key: 'invoice.date', label: 'Invoice date', group: 'Invoice', type: 'date' })).toEqual({
      field: 'invoice.date',
      op: 'date_range',
      values: [],
      preset: 'this-quarter',
    });
  });
});

describe('totalLabel', () => {
  it('reads like the column it produces', () => {
    expect(totalLabel({ fn: 'count' }, SOURCE)).toBe('Count');
    expect(totalLabel({ fn: 'avg', field: 'net_amount' }, SOURCE)).toBe('Average of Net amount');
  });
});

describe('saveableDefinition', () => {
  const now = new Date(2026, 10, 6);
  const LIST: CustomReportDefinition = { source: 'invoice_lines', columns: ['item_name'], filters: [], totals: [], chart: 'none' };

  it('fills a relative date preset with its dates (the server only accepts two real dates) and keeps the preset', () => {
    const def: CustomReportDefinition = {
      ...LIST,
      filters: [{ field: 'invoice.date', op: 'date_range', values: [], preset: 'this-quarter' }],
    };
    expect(saveableDefinition(def, SOURCE, now).filters).toEqual([
      { field: 'invoice.date', op: 'date_range', values: ['2026-10-01', '2026-11-06'], preset: 'this-quarter' },
    ]);
  });

  it('drops half-filled filters and strips thousands separators, exactly as the preview does', () => {
    const def: CustomReportDefinition = {
      ...LIST,
      filters: [
        { field: 'sku', op: 'eq', values: [''] },
        { field: 'invoice.status', op: 'in', values: [] },
        { field: 'net_amount', op: 'gt', values: ['1,000'] },
      ],
    };
    expect(saveableDefinition(def, SOURCE, now).filters).toEqual([{ field: 'net_amount', op: 'gt', values: ['1000'] }]);
  });

  it('keeps everything else, even when the report cannot run yet', () => {
    const def: CustomReportDefinition = { ...LIST, columns: [] };
    expect(saveableDefinition(def, SOURCE, now)).toMatchObject({ source: 'invoice_lines', columns: [], chart: 'none' });
  });
});
