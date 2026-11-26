import { describe, it, expect } from 'vitest';
import type { AppHealth, HealthSnapshot } from '@/types/systemHealth';
import { appStateLabel, formatAge, formatUsage, isStale, meterValue, sortApps, wakeInterval } from './systemHealth';

const NOW = Date.parse('2026-11-25T14:30:00Z');
const MIN = 60 * 1000;

function app(overrides: Partial<AppHealth>): AppHealth {
  return { app: 'a', machines: [], crashing: false, awakeHours24h: null, wakes24h: null, errors5xx24h: null, ...overrides };
}

describe('formatAge', () => {
  it.each([
    [null, '—'],
    ['not a date', 'not a date'],
    [new Date(NOW - 20 * 1000).toISOString(), 'just now'],
    [new Date(NOW - 12 * MIN).toISOString(), '12 min ago'],
    [new Date(NOW - 3 * 60 * MIN).toISOString(), '3 h ago'],
    [new Date(NOW - 24 * 60 * MIN).toISOString(), '1 day ago'],
    [new Date(NOW - 49 * 60 * MIN).toISOString(), '2 days ago'],
  ])('%s → %s', (iso, want) => {
    expect(formatAge(iso, NOW)).toBe(want);
  });
});

describe('isStale', () => {
  const snap = (checkedAt: string) => ({ checkedAt }) as HealthSnapshot;
  it('is fresh within two hours and stale after', () => {
    expect(isStale(snap(new Date(NOW - 119 * MIN).toISOString()), NOW)).toBe(false);
    expect(isStale(snap(new Date(NOW - 121 * MIN).toISOString()), NOW)).toBe(true);
    expect(isStale(snap('garbage'), NOW)).toBe(true);
  });
});

describe('formatUsage and meterValue', () => {
  it('formats and caps over-limit usage', () => {
    const part = { used: 110.36, limit: 100, percent: 110.4 };
    expect(formatUsage(part, 'CU-h')).toBe('110.36 / 100 CU-h (110.4%)');
    expect(meterValue(part)).toBe(100);
    expect(formatUsage({ used: null, limit: 5, percent: null }, 'GB')).toBe('—');
    expect(meterValue({ used: null, limit: 5, percent: null })).toBe(0);
  });
});

describe('appStateLabel', () => {
  it.each([
    [app({ crashing: true }), 'Crashing'],
    [app({}), 'No machines'],
    [app({ machines: [{ id: '1', state: 'stopped', region: null, lastExit: null, crashing: false }, { id: '2', state: 'stopped', region: null, lastExit: null, crashing: false }] }), 'stopped'],
  ])('%#', (a, want) => {
    expect(appStateLabel(a)).toBe(want);
  });
});

describe('wakeInterval', () => {
  it.each([[96, 'every ~15 min'], [0, '—'], [null, '—']])('%s → %s', (w, want) => {
    expect(wakeInterval(w)).toBe(want);
  });
});

describe('sortApps', () => {
  it('puts crashing apps first, then the most awake', () => {
    const sorted = sortApps([
      app({ app: 'quiet', awakeHours24h: 0.2 }),
      app({ app: 'busy', awakeHours24h: 10.6 }),
      app({ app: 'broken', crashing: true, awakeHours24h: 0 }),
    ]);
    expect(sorted.map((a) => a.app)).toEqual(['broken', 'busy', 'quiet']);
  });
});
