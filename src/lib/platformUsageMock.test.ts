import { describe, it, expect } from 'vitest';
import { mockAckAlert, mockOverview, mockTenantUsage, mockWatchlist } from './platformUsageMock';

describe('platformUsageMock', () => {
  it('returns one row per sample tenant, with period-length trends', () => {
    const overview = mockOverview('7d');
    expect(overview.tenants).toHaveLength(10);
    const acme = overview.tenants.find((t) => t.slug === 'acme-stone');
    expect(acme?.computeTrend).toHaveLength(7);
    expect(overview.fleet.computeTrend).toHaveLength(7);
  });

  it('leaves a pending tenant unmeasured', () => {
    const pending = mockOverview('30d').tenants.find((t) => t.status === 'pending');
    expect(pending?.computeHours).toBeNull();
    expect(pending?.computeTrend).toEqual([]);
  });

  it('is deterministic', () => {
    expect(mockOverview('30d').fleet.computeHours).toBe(mockOverview('30d').fleet.computeHours);
  });

  it('returns null detail for an unknown tenant', () => {
    expect(mockTenantUsage('nope', '30d')).toBeNull();
    expect(mockTenantUsage('t-acme', '30d')?.series).toHaveLength(30);
  });

  it('drops an acknowledged alert from the watch list', () => {
    const before = mockWatchlist().length;
    expect(mockAckAlert('a-5', 7)).toBe(true);
    expect(mockWatchlist()).toHaveLength(before - 1);
    expect(mockAckAlert('unknown')).toBe(false);
  });
});
