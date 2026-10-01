import { describe, it, expect } from 'vitest';
import { countByFilter, filterTenants } from './onboardingStatusFilter';
import type { Tenant } from '@/types/tenant';

const make = (id: string, status: string): Tenant => ({
  id,
  slug: id,
  displayName: id,
  status,
  migrationStatus: 'migrated',
  dbName: id,
  createdAt: '2026-01-01T00:00:00Z',
});

const TENANTS = [
  make('a', 'submitted'),
  make('b', 'invited'),
  make('c', 'invited'),
  make('d', 'active'),
  make('e', 'suspended'),
  make('f', 'rejected'),
];

describe('countByFilter', () => {
  it('counts each card and ignores uncovered statuses', () => {
    expect(countByFilter(TENANTS)).toEqual({ pending: 1, invited: 2, active: 1, suspended: 1 });
  });
  it('returns zeros for an empty list', () => {
    expect(countByFilter([])).toEqual({ pending: 0, invited: 0, active: 0, suspended: 0 });
  });
});

describe('filterTenants', () => {
  it.each([
    ['pending', ['a']],
    ['invited', ['b', 'c']],
    ['active', ['d']],
    ['suspended', ['e']],
  ] as const)('filters by %s', (key, ids) => {
    expect(filterTenants(TENANTS, key).map((t) => t.id)).toEqual(ids);
  });
  it('returns everything (including uncovered statuses) with no filter', () => {
    expect(filterTenants(TENANTS, null)).toHaveLength(TENANTS.length);
  });
});
