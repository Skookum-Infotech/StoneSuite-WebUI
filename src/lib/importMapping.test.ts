import { describe, it, expect } from 'vitest';
import { applyColumnMapping, collectRawColumns } from './importMapping';
import type { FieldDefinition } from '@/types/tenant';

function fieldDef(overrides: Partial<FieldDefinition>): FieldDefinition {
  return {
    id: 'f1',
    workflowId: 'w1',
    key: 'budget',
    label: 'Budget',
    dataType: 'string',
    required: false,
    options: [],
    validation: {},
    sortOrder: 0,
    ...overrides,
  };
}

describe('applyColumnMapping', () => {
  it('splits core and custom fields, coercing custom values to their DataType', () => {
    const defs = [fieldDef({ key: 'budget', dataType: 'number' })];
    const result = applyColumnMapping(
      { Name: 'Acme Corp', Budget: '5000', Notes: 'ignored column' },
      { Name: 'core:customer_name', Budget: 'cf:budget', Notes: '' },
      defs,
    );
    expect(result).toEqual({
      core: { customer_name: 'Acme Corp' },
      custom: { budget: 5000 },
    });
  });

  it('leaves an unparseable number as the raw string', () => {
    const defs = [fieldDef({ key: 'budget', dataType: 'number' })];
    const result = applyColumnMapping({ Budget: 'not-a-number' }, { Budget: 'cf:budget' }, defs);
    expect(result.custom.budget).toBe('not-a-number');
  });

  it('parses a bool custom field', () => {
    const defs = [fieldDef({ key: 'active', dataType: 'bool' })];
    const result = applyColumnMapping({ Active: 'true' }, { Active: 'cf:active' }, defs);
    expect(result.custom.active).toBe(true);
  });

  it('leaves an empty cell as an empty string rather than 0/false', () => {
    const defs = [fieldDef({ key: 'budget', dataType: 'number' })];
    const result = applyColumnMapping({ Budget: '' }, { Budget: 'cf:budget' }, defs);
    expect(result.custom.budget).toBe('');
  });

  it('skips a column with no mapping target', () => {
    const result = applyColumnMapping({ Extra: 'x' }, {}, []);
    expect(result).toEqual({ core: {}, custom: {} });
  });
});

describe('collectRawColumns', () => {
  it('unions column headers across all rows, deduplicated', () => {
    const columns = collectRawColumns([
      { raw: { Name: 'a', Budget: '1' } },
      { raw: { Name: 'b', Notes: 'x' } },
    ]);
    expect(columns.sort()).toEqual(['Budget', 'Name', 'Notes']);
  });

  it('returns an empty array for no rows', () => {
    expect(collectRawColumns([])).toEqual([]);
  });
});
