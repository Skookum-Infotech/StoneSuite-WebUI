import { describe, it, expect } from 'vitest';
import { initBuilder } from './builderInit';
import { CUSTOM_REPORT_NAME_MAX } from '@/types/customReports';
import type { CatalogSource, CustomReportDefinition, SavedCustomReport } from '@/types/customReports';

const CATALOG: CatalogSource[] = [
  {
    key: 'invoice_lines',
    label: 'Invoice lines',
    module: 'sales',
    fields: [
      { key: 'item_name', label: 'Line item name', group: '', type: 'text' },
      { key: 'net_amount', label: 'Net amount', group: '', type: 'money' },
    ],
  },
  { key: 'payments', label: 'Payments', module: 'sales', fields: [{ key: 'number', label: 'Number', group: '', type: 'text' }] },
];

const DEFINITION: CustomReportDefinition = { source: 'invoice_lines', columns: ['item_name'], filters: [], totals: [], chart: 'none' };

const SAVED: SavedCustomReport = {
  id: 'r-1',
  name: 'My list',
  definition: DEFINITION,
  shared: true,
  ownerName: 'Pat Doe',
  isMine: true,
  updatedAt: '2026-11-05T10:00:00Z',
};

describe('initBuilder', () => {
  it('opens a saved report as it was saved', () => {
    const init = initBuilder(CATALOG, SAVED, undefined);
    expect(init).toMatchObject({ kind: 'ready', name: 'My list', shared: true, removed: [], note: null });
    expect(init.kind === 'ready' && init.source.key).toBe('invoice_lines');
  });

  it('drops fields the catalog no longer has and lists them', () => {
    const init = initBuilder(CATALOG, { ...SAVED, definition: { ...DEFINITION, columns: ['item_name', 'ghost'] } }, undefined);
    expect(init.kind === 'ready' && init.definition.columns).toEqual(['item_name']);
    expect(init.kind === 'ready' && init.removed).toEqual(['ghost']);
  });

  it('says there is no access when a saved report’s source is not in the caller’s catalog', () => {
    expect(initBuilder(CATALOG, { ...SAVED, definition: { ...DEFINITION, source: 'vendors' } }, undefined)).toEqual({ kind: 'no-access' });
  });

  it('opens on the assistant’s interpretation, named after what it understood', () => {
    const init = initBuilder(CATALOG, undefined, { definition: DEFINITION, summary: 'Revenue by item', dropped: ['ghost'] });
    expect(init).toMatchObject({ kind: 'ready', name: 'Revenue by item', shared: false, note: { summary: 'Revenue by item', dropped: ['ghost'] } });
  });

  it('keeps a long summary within the name limit', () => {
    const init = initBuilder(CATALOG, undefined, { definition: DEFINITION, summary: 'x'.repeat(300), dropped: [] });
    expect(init.kind === 'ready' && init.name).toHaveLength(CUSTOM_REPORT_NAME_MAX);
  });

  it('starts empty on the first source when there is nothing to open', () => {
    const init = initBuilder(CATALOG, undefined, undefined);
    expect(init).toMatchObject({ kind: 'ready', name: 'Untitled report', shared: false, note: null });
    expect(init.kind === 'ready' && init.definition.columns).toEqual(['item_name', 'net_amount']);
  });

  it('falls back to an empty report when the interpretation names a source the caller cannot use', () => {
    const init = initBuilder(CATALOG, undefined, { definition: { ...DEFINITION, source: 'vendors' }, summary: 'x', dropped: [] });
    expect(init).toMatchObject({ kind: 'ready', name: 'Untitled report', note: null });
  });

  it('reports no sources when the caller can use none', () => {
    expect(initBuilder([], undefined, undefined)).toEqual({ kind: 'no-sources' });
  });
});
