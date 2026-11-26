import { describe, it, expect } from 'vitest';
import type { TenantUsageRow } from '@/types/platformUsage';
import { ALL_STATUSES, defaultDir, filterUsageRows, sortUsageRows, statusOptions } from './tenantUsageTable';

function row(name: string, overrides: Partial<TenantUsageRow> = {}): TenantUsageRow {
  return {
    tenantId: name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    displayName: name,
    status: 'active',
    activeUsers: 1,
    totalUsers: 2,
    computeHours: 1,
    computeHoursPrev: 1,
    dbBytes: 1,
    dbBytesPrev: 1,
    r2Bytes: 1,
    r2BytesPrev: 1,
    aiTokens: 1,
    aiTokensPrev: 1,
    errorRatePct: 0,
    errorRate24hPct: 0,
    computeTrend: [],
    topSeverity: null,
    ...overrides,
  };
}

const ROWS = [
  row('Acme Stone', { computeHours: 36, topSeverity: 'critical' }),
  row('Granite Co', { computeHours: 32, topSeverity: 'warning' }),
  row('Marble Inc', { computeHours: 1.5, topSeverity: 'info', status: 'suspended' }),
  row('NewTile Studio', { computeHours: null, status: 'pending', totalUsers: 0, activeUsers: 0 }),
];

const names = (rows: TenantUsageRow[]) => rows.map((r) => r.displayName);

describe('filterUsageRows', () => {
  it.each<[string, string, string[]]>([
    ['', ALL_STATUSES, ['Acme Stone', 'Granite Co', 'Marble Inc', 'NewTile Studio']],
    ['acme', ALL_STATUSES, ['Acme Stone']],
    ['  GRANITE ', ALL_STATUSES, ['Granite Co']],
    ['newtile-studio', ALL_STATUSES, ['NewTile Studio']],
    ['', 'suspended', ['Marble Inc']],
    ['acme', 'suspended', []],
  ])('query %j, status %s', (query, status, expected) => {
    expect(names(filterUsageRows(ROWS, query, status))).toEqual(expected);
  });
});

describe('sortUsageRows', () => {
  it('sorts names A→Z and Z→A', () => {
    expect(names(sortUsageRows(ROWS, 'name', 'desc'))).toEqual(['NewTile Studio', 'Marble Inc', 'Granite Co', 'Acme Stone']);
    expect(names(sortUsageRows(ROWS, 'name', 'asc'))[0]).toBe('Acme Stone');
  });

  it('keeps unmeasured values last in both directions', () => {
    expect(names(sortUsageRows(ROWS, 'compute', 'desc'))).toEqual(['Acme Stone', 'Granite Co', 'Marble Inc', 'NewTile Studio']);
    expect(names(sortUsageRows(ROWS, 'compute', 'asc'))).toEqual(['Marble Inc', 'Granite Co', 'Acme Stone', 'NewTile Studio']);
    expect(names(sortUsageRows(ROWS, 'users', 'asc')).at(-1)).toBe('NewTile Studio');
  });

  it('puts the most severe alert first when sorting by alert, descending', () => {
    expect(names(sortUsageRows(ROWS, 'alert', 'desc'))).toEqual(['Acme Stone', 'Granite Co', 'Marble Inc', 'NewTile Studio']);
  });

  it('does not mutate its input', () => {
    const input = [...ROWS];
    sortUsageRows(input, 'name', 'desc');
    expect(input).toEqual(ROWS);
  });
});

describe('statusOptions', () => {
  it('lists each status once, sorted', () => {
    expect(statusOptions(ROWS)).toEqual(['active', 'pending', 'suspended']);
  });
});

describe('defaultDir', () => {
  it.each([
    ['name', 'asc'],
    ['compute', 'desc'],
    ['alert', 'desc'],
  ] as const)('%s → %s', (key, expected) => {
    expect(defaultDir(key)).toBe(expected);
  });
});
