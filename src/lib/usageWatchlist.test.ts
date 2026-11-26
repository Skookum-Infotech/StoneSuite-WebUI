import { describe, it, expect } from 'vitest';
import type { AlertSeverity, UsageAlert } from '@/types/platformUsage';
import {
  activeAlerts,
  formatChange,
  highestSeverity,
  percentChange,
  ruleLabel,
  sortAlerts,
} from './usageWatchlist';

function alert(id: string, severity: AlertSeverity, overrides: Partial<UsageAlert> = {}): UsageAlert {
  return {
    id,
    tenantId: 't-1',
    tenantName: 'Acme',
    ruleKey: 'spike',
    metricKey: 'compute',
    severity,
    message: 'msg',
    firstSeenAt: '2026-11-01T00:00:00Z',
    lastSeenAt: '2026-11-20T00:00:00Z',
    status: 'open',
    ...overrides,
  };
}

describe('ruleLabel', () => {
  it.each([
    ['rapid_growth', 'Rapid growth'],
    ['error_rate', 'Error rate'],
    ['dormant', 'Dormant'],
    ['quota_exceeded', 'Over quota'],
    ['brand_new_rule', 'Brand new rule'],
    ['', 'Alert'],
  ])('%s → %s', (key, expected) => {
    expect(ruleLabel(key)).toBe(expected);
  });
});

describe('sortAlerts', () => {
  it('puts the most severe first, then the most recently seen', () => {
    const list = [
      alert('info', 'info'),
      alert('warn-old', 'warning', { lastSeenAt: '2026-11-01T00:00:00Z' }),
      alert('crit', 'critical'),
      alert('warn-new', 'warning', { lastSeenAt: '2026-11-24T00:00:00Z' }),
    ];
    expect(sortAlerts(list).map((a) => a.id)).toEqual(['crit', 'warn-new', 'warn-old', 'info']);
  });

  it('does not mutate its input', () => {
    const list = [alert('a', 'info'), alert('b', 'critical')];
    sortAlerts(list);
    expect(list.map((a) => a.id)).toEqual(['a', 'b']);
  });
});

describe('activeAlerts', () => {
  const now = new Date('2026-11-25T00:00:00Z');
  it.each<[string, Partial<UsageAlert>, boolean]>([
    ['open', { status: 'open' }, true],
    ['acked', { status: 'acked' }, false],
    ['resolved', { status: 'resolved' }, false],
    ['snoozed, still sleeping', { status: 'snoozed', snoozedUntil: '2026-12-01T00:00:00Z' }, false],
    ['snoozed, expired', { status: 'snoozed', snoozedUntil: '2026-11-20T00:00:00Z' }, true],
    ['snoozed, no date', { status: 'snoozed', snoozedUntil: null }, false],
  ])('%s → %s', (_name, overrides, expected) => {
    expect(activeAlerts([alert('x', 'warning', overrides)], now)).toHaveLength(expected ? 1 : 0);
  });
});

describe('highestSeverity', () => {
  it.each<[AlertSeverity[], AlertSeverity | null]>([
    [[], null],
    [['info'], 'info'],
    [['info', 'warning'], 'warning'],
    [['warning', 'critical', 'info'], 'critical'],
  ])('%j → %s', (severities, expected) => {
    expect(highestSeverity(severities.map((s, i) => alert(String(i), s)))).toBe(expected);
  });
});

describe('percentChange', () => {
  it.each<[number | null, number | null, number | null]>([
    [150, 100, 50],
    [50, 100, -50],
    [100, 100, 0],
    [10, 0, null],
    [null, 100, null],
    [100, null, null],
    [Number.NaN, 100, null],
  ])('(%s, %s) → %s', (now, prev, expected) => {
    expect(percentChange(now, prev)).toBe(expected);
  });
});

describe('formatChange', () => {
  it.each<[number | null, string]>([
    [3.14, '+3.1%'],
    [-3.14, '-3.1%'],
    [211.4, '+211%'],
    [0, '+0.0%'],
    [null, '—'],
  ])('%s → %s', (change, expected) => {
    expect(formatChange(change)).toBe(expected);
  });
});
