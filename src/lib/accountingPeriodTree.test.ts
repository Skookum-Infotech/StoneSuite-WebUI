import { describe, it, expect } from 'vitest';
import type { FiscalYear, Period, PeriodStatus } from '@/types/accountingPeriod';
import {
  quarterNumber, fiscalYearNumeral, fiscalYearDisplayLabel, quarterLabel,
  deriveRollupStatus, formatDateRange, buildFiscalYearTree, flattenTree, allGroupKeys,
} from './accountingPeriodTree';

function makeFiscalYear(overrides: Partial<FiscalYear> = {}): FiscalYear {
  return {
    id: 'fy-1', name: 'FY2026', start: '2026-01-01', end: '2026-12-31',
    status: 'open', createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makePeriod(overrides: Partial<Period> = {}): Period {
  return {
    id: 'p-1', fiscalYearId: 'fy-1', fiscalYearName: 'FY2026', name: 'Jan 2026',
    periodNumber: 1, start: '2026-01-01', end: '2026-01-31', status: 'open',
    isBasePeriod: false, createdAt: '2026-01-01T00:00:00Z', updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('quarterNumber', () => {
  it.each([
    [1, 1], [2, 1], [3, 1],
    [4, 2], [5, 2], [6, 2],
    [7, 3], [8, 3], [9, 3],
    [10, 4], [11, 4], [12, 4],
  ])('maps period %i to quarter %i', (period, quarter) => {
    expect(quarterNumber(period)).toBe(quarter);
  });
});

describe('fiscalYearNumeral / fiscalYearDisplayLabel / quarterLabel', () => {
  it('strips the FY prefix', () => {
    expect(fiscalYearNumeral('FY2026')).toBe('2026');
  });

  it('formats the spaced display label', () => {
    expect(fiscalYearDisplayLabel('FY2026')).toBe('FY 2026');
  });

  it('formats a quarter label from the fiscal year name', () => {
    expect(quarterLabel('FY2026', 1)).toBe('Q1 2026');
    expect(quarterLabel('FY2026', 4)).toBe('Q4 2026');
  });
});

describe('deriveRollupStatus', () => {
  it('is open for an empty group', () => {
    expect(deriveRollupStatus([])).toBe('open');
  });

  it('is closed only when every period is closed', () => {
    const closed = [{ status: 'closed' as PeriodStatus }, { status: 'closed' as PeriodStatus }];
    expect(deriveRollupStatus(closed)).toBe('closed');
  });

  it('is open when any period is still open', () => {
    const mixed = [{ status: 'closed' as PeriodStatus }, { status: 'open' as PeriodStatus }];
    expect(deriveRollupStatus(mixed)).toBe('open');
  });
});

describe('formatDateRange', () => {
  it('renders full dates on both ends, even within the same year', () => {
    expect(formatDateRange('2026-02-01', '2026-02-28')).toBe('1 Feb 2026 – 28 Feb 2026');
  });

  it('renders full dates across a fiscal year straddling two calendar years', () => {
    expect(formatDateRange('2025-07-01', '2026-06-30')).toBe('1 Jul 2025 – 30 Jun 2026');
  });
});

describe('buildFiscalYearTree', () => {
  it('groups twelve periods into four quarters of three months each', () => {
    const fy = makeFiscalYear();
    const periods = Array.from({ length: 12 }, (_, i) =>
      makePeriod({ id: `p-${i + 1}`, periodNumber: i + 1, name: `M${i + 1}` }));

    const tree = buildFiscalYearTree([fy], periods);

    expect(tree).toHaveLength(1);
    expect(tree[0].quarters).toHaveLength(4);
    expect(tree[0].quarters.map((q) => q.periods.length)).toEqual([3, 3, 3, 3]);
    expect(tree[0].quarters[0].label).toBe('Q1 2026');
  });

  it('derives quarter status from its own periods only', () => {
    const fy = makeFiscalYear();
    const periods = [
      makePeriod({ id: 'p-1', periodNumber: 1, status: 'closed' }),
      makePeriod({ id: 'p-2', periodNumber: 2, status: 'closed' }),
      makePeriod({ id: 'p-3', periodNumber: 3, status: 'closed' }),
      makePeriod({ id: 'p-4', periodNumber: 4, status: 'open' }),
    ];

    const tree = buildFiscalYearTree([fy], periods);

    expect(tree[0].quarters[0].status).toBe('closed');
    expect(tree[0].quarters[1].status).toBe('open');
  });

  it('drops periods whose fiscalYearId matches no listed fiscal year', () => {
    const fy = makeFiscalYear({ id: 'fy-1' });
    const periods = [makePeriod({ fiscalYearId: 'fy-orphan' })];

    const tree = buildFiscalYearTree([fy], periods);

    expect(tree[0].quarters).toHaveLength(0);
  });

  it('omits quarters with no generated periods', () => {
    const fy = makeFiscalYear();
    const periods = [makePeriod({ id: 'p-1', periodNumber: 1 })];

    const tree = buildFiscalYearTree([fy], periods);

    expect(tree[0].quarters).toHaveLength(1);
    expect(tree[0].quarters[0].quarterNumber).toBe(1);
  });
});

describe('flattenTree / allGroupKeys', () => {
  function buildSampleTree() {
    const fy = makeFiscalYear();
    const periods = Array.from({ length: 6 }, (_, i) =>
      makePeriod({ id: `p-${i + 1}`, periodNumber: i + 1, name: `M${i + 1}` }));
    return buildFiscalYearTree([fy], periods);
  }

  it('expands every row when nothing is collapsed', () => {
    const tree = buildSampleTree();
    const rows = flattenTree(tree, new Set());

    // 1 year + 2 quarters + 6 months
    expect(rows).toHaveLength(9);
    expect(rows.filter((r) => r.level === 'month')).toHaveLength(6);
  });

  it('skips months under a collapsed quarter but keeps sibling quarters', () => {
    const tree = buildSampleTree();
    const collapsed = new Set([tree[0].quarters[0].key]);
    const rows = flattenTree(tree, collapsed);

    // 1 year + 2 quarters + 3 months (only the second quarter's)
    expect(rows).toHaveLength(6);
    expect(rows.filter((r) => r.level === 'month')).toHaveLength(3);
  });

  it('skips everything under a collapsed year', () => {
    const tree = buildSampleTree();
    const collapsed = new Set([tree[0].key]);
    const rows = flattenTree(tree, collapsed);

    expect(rows).toHaveLength(1);
    expect(rows[0].level).toBe('year');
  });

  it('allGroupKeys lists every year and quarter key, collapsing which reproduces the fully-collapsed flatten', () => {
    const tree = buildSampleTree();
    const keys = allGroupKeys(tree);

    expect(keys).toEqual([tree[0].key, tree[0].quarters[0].key, tree[0].quarters[1].key]);
    expect(flattenTree(tree, new Set(keys))).toHaveLength(1);
  });
});
