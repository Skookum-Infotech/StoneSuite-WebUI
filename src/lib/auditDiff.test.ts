import { describe, it, expect } from 'vitest';
import { diffSnapshots, extractSnapshots, formatAuditValue, fieldLabel } from './auditDiff';

describe('diffSnapshots', () => {
  const cases: Array<[string, Record<string, unknown> | undefined, Record<string, unknown> | undefined, string[]]> = [
    ['only changed fields', { status: 'Open', total: 5 }, { status: 'Paid', total: 5 }, ['status']],
    ['ignores noisy keys', { id: 'a', updated_at: '1' }, { id: 'b', updated_at: '2' }, []],
    ['nested keys are flattened', { a: { b: 1 } }, { a: { b: 2 } }, ['a.b']],
    ['create has no diff', undefined, { name: 'X' }, []],
    ['delete has no diff', { name: 'X' }, undefined, []],
  ];
  it.each(cases)('%s', (_n, o, n, expected) => {
    expect(diffSnapshots(o, n).map((c) => c.field)).toEqual(expected);
  });

  it('formats from/to and label', () => {
    expect(diffSnapshots({ balanceDue: 10 }, { balanceDue: null })).toEqual([
      { field: 'balanceDue', label: 'Balance Due', from: '10', to: '—' },
    ]);
  });
});

describe('extractSnapshots', () => {
  it('reads old/new and tolerates junk', () => {
    expect(extractSnapshots({ old: { a: 1 }, new: { a: 2 } })).toEqual({ old: { a: 1 }, new: { a: 2 } });
    expect(extractSnapshots(null)).toEqual({});
    expect(extractSnapshots({ new: 'x' })).toEqual({ old: undefined, new: undefined });
  });
});

describe('formatAuditValue / fieldLabel', () => {
  it('formats primitives', () => {
    expect(formatAuditValue(true)).toBe('Yes');
    expect(formatAuditValue('')).toBe('—');
    expect(formatAuditValue([1, 2, 3, 4])).toBe('1, 2, 3 (+1 more)');
  });
  it('humanizes camelCase and snake_case', () => {
    expect(fieldLabel('salesTaxPercent')).toBe('Sales Tax Percent');
    expect(fieldLabel('vendor_id')).toBe('Vendor Id');
  });
});
