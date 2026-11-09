import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { builderReducer, useCustomReportBuilder } from './useCustomReportBuilder';
import { CUSTOM_MAX_COLUMNS, CUSTOM_MAX_FILTERS, CUSTOM_MAX_TOTALS } from '@/types/customReports';
import type { CatalogSource, CustomFilterRule, CustomReportDefinition } from '@/types/customReports';

const MANY_FIELDS = Array.from({ length: CUSTOM_MAX_COLUMNS + 1 }, (_, i) => ({
  key: `f${i}`,
  label: `Field ${i}`,
  group: '',
  type: 'text' as const,
}));

const SOURCE: CatalogSource = { key: 'invoice_lines', label: 'Invoice lines', module: 'sales', fields: MANY_FIELDS };

const LIST: CustomReportDefinition = { source: 'invoice_lines', columns: ['f0'], filters: [], totals: [], chart: 'none' };

const GROUPED: CustomReportDefinition = {
  source: 'invoice_lines',
  columns: [],
  filters: [],
  groupBy: { field: 'f0' },
  totals: [{ fn: 'count' }, { fn: 'sum', field: 'f1' }],
  chart: 'bar',
  sort: { key: 'total:1', desc: true },
  topN: 5,
};

describe('builderReducer', () => {
  it('setSource starts over on the new source', () => {
    const other: CatalogSource = { key: 'payments', label: 'Payments', module: 'sales', fields: MANY_FIELDS.slice(0, 5) };
    const out = builderReducer(GROUPED, { type: 'setSource', source: other });
    expect(out).toEqual({ source: 'payments', columns: ['f0', 'f1', 'f2'], filters: [], totals: [], chart: 'none' });
  });

  it('replace swaps in a whole definition', () => {
    expect(builderReducer(LIST, { type: 'replace', definition: GROUPED })).toBe(GROUPED);
  });

  describe('columns', () => {
    it('toggleColumn adds a column and removes it again', () => {
      const added = builderReducer(LIST, { type: 'toggleColumn', key: 'f1' });
      expect(added.columns).toEqual(['f0', 'f1']);
      expect(builderReducer(added, { type: 'toggleColumn', key: 'f1' }).columns).toEqual(['f0']);
    });

    it('refuses a column past the limit', () => {
      const full: CustomReportDefinition = { ...LIST, columns: MANY_FIELDS.slice(0, CUSTOM_MAX_COLUMNS).map((f) => f.key) };
      const out = builderReducer(full, { type: 'toggleColumn', key: `f${CUSTOM_MAX_COLUMNS}` });
      expect(out.columns).toHaveLength(CUSTOM_MAX_COLUMNS);
    });

    it('drops a sort on a column that was removed', () => {
      const sorted: CustomReportDefinition = { ...LIST, sort: { key: 'f0', desc: false } };
      expect(builderReducer(sorted, { type: 'toggleColumn', key: 'f0' }).sort).toBeUndefined();
    });
  });

  describe('filters', () => {
    const RULE: CustomFilterRule = { field: 'f0', op: 'eq', values: ['a'] };

    it('adds, edits and removes filters, keeping the order of the rest', () => {
      let def = builderReducer(LIST, { type: 'addFilter', rule: { ...RULE, values: ['1'] } });
      def = builderReducer(def, { type: 'addFilter', rule: { ...RULE, values: ['2'] } });
      def = builderReducer(def, { type: 'addFilter', rule: { ...RULE, values: ['3'] } });
      def = builderReducer(def, { type: 'setFilter', index: 1, rule: { ...RULE, values: ['two'] } });
      expect(def.filters.map((f) => f.values[0])).toEqual(['1', 'two', '3']);
      def = builderReducer(def, { type: 'removeFilter', index: 0 });
      expect(def.filters.map((f) => f.values[0])).toEqual(['two', '3']);
    });

    it('refuses a filter past the limit', () => {
      let def = LIST;
      for (let i = 0; i < CUSTOM_MAX_FILTERS + 2; i++) def = builderReducer(def, { type: 'addFilter', rule: { ...RULE } });
      expect(def.filters).toHaveLength(CUSTOM_MAX_FILTERS);
    });
  });

  describe('grouping', () => {
    it('grouping an ungrouped report adds a count so it can run', () => {
      const out = builderReducer(LIST, { type: 'setGroupBy', groupBy: { field: 'f0' } });
      expect(out.groupBy).toEqual({ field: 'f0' });
      expect(out.totals).toEqual([{ fn: 'count' }]);
    });

    it('grouping keeps the totals it already has', () => {
      const withTotals: CustomReportDefinition = { ...LIST, totals: [{ fn: 'sum', field: 'f1' }] };
      expect(builderReducer(withTotals, { type: 'setGroupBy', groupBy: { field: 'f0' } }).totals).toEqual([{ fn: 'sum', field: 'f1' }]);
    });

    it('ungrouping removes the chart and any sort on the group or a total', () => {
      const out = builderReducer(GROUPED, { type: 'setGroupBy', groupBy: null });
      expect(out.groupBy).toBeUndefined();
      expect(out.chart).toBe('none');
      expect(out.sort).toBeUndefined();
    });

    it('grouping drops a sort on a plain column', () => {
      const sorted: CustomReportDefinition = { ...LIST, sort: { key: 'f0', desc: true } };
      expect(builderReducer(sorted, { type: 'setGroupBy', groupBy: { field: 'f0' } }).sort).toBeUndefined();
    });
  });

  describe('totals', () => {
    it('replaces the totals and keeps at most five', () => {
      const six = Array.from({ length: CUSTOM_MAX_TOTALS + 1 }, () => ({ fn: 'count' as const }));
      expect(builderReducer(GROUPED, { type: 'setTotals', totals: six }).totals).toHaveLength(CUSTOM_MAX_TOTALS);
    });

    it('drops a sort on a total that no longer exists', () => {
      const out = builderReducer(GROUPED, { type: 'setTotals', totals: [{ fn: 'count' }] });
      expect(out.sort).toBeUndefined();
    });

    it('keeps a sort whose total still exists', () => {
      const out = builderReducer(GROUPED, { type: 'setTotals', totals: [{ fn: 'count' }, { fn: 'avg', field: 'f2' }] });
      expect(out.sort).toEqual({ key: 'total:1', desc: true });
    });
  });

  describe('sort, top N and chart', () => {
    it('sets and clears the sort and top N together', () => {
      let def = builderReducer(GROUPED, { type: 'setSort', sort: { key: 'group', desc: false }, topN: 20 });
      expect(def.sort).toEqual({ key: 'group', desc: false });
      expect(def.topN).toBe(20);
      def = builderReducer(def, { type: 'setSort', sort: null, topN: 0 });
      expect(def.sort).toBeUndefined();
      expect(def.topN).toBeUndefined();
    });

    it('clamps top N to the limit', () => {
      expect(builderReducer(GROUPED, { type: 'setSort', sort: null, topN: 999 }).topN).toBe(100);
    });

    it('a bar chart needs a group and a total', () => {
      expect(builderReducer(LIST, { type: 'setChart', chart: 'bar' }).chart).toBe('none');
      expect(builderReducer({ ...GROUPED, chart: 'none' }, { type: 'setChart', chart: 'bar' }).chart).toBe('bar');
    });
  });

  it('never mutates the definition it is given', () => {
    const before = JSON.stringify(GROUPED);
    builderReducer(GROUPED, { type: 'toggleColumn', key: 'f3' });
    builderReducer(GROUPED, { type: 'setGroupBy', groupBy: null });
    builderReducer(GROUPED, { type: 'setTotals', totals: [] });
    expect(JSON.stringify(GROUPED)).toBe(before);
  });
});

describe('useCustomReportBuilder', () => {
  it('starts from the given definition and applies dispatched actions', () => {
    const { result } = renderHook(() => useCustomReportBuilder(LIST));
    expect(result.current.definition).toEqual(LIST);
    act(() => result.current.dispatch({ type: 'toggleColumn', key: 'f1' }));
    expect(result.current.definition.columns).toEqual(['f0', 'f1']);
  });

  it('replace puts a whole new definition in place (used by Describe a change and Undo)', () => {
    const { result } = renderHook(() => useCustomReportBuilder(LIST));
    act(() => result.current.dispatch({ type: 'replace', definition: GROUPED }));
    expect(result.current.definition).toEqual(GROUPED);
    expect(SOURCE.key).toBe(result.current.definition.source);
  });
});
