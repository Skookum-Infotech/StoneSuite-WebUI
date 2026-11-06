import { describe, it, expect } from 'vitest';
import { REPORT_RANGE_PRESETS, resolveReportRange, type ReportRangePreset } from './reportDateRange';

describe('resolveReportRange', () => {
  const cases: { name: string; preset: ReportRangePreset; now: Date; from: string; to: string }[] = [
    { name: 'this month', preset: 'this-month', now: new Date(2026, 10, 6), from: '2026-11-01', to: '2026-11-06' },
    { name: 'last month', preset: 'last-month', now: new Date(2026, 10, 6), from: '2026-10-01', to: '2026-10-31' },
    { name: 'last month across a year boundary', preset: 'last-month', now: new Date(2026, 0, 15), from: '2025-12-01', to: '2025-12-31' },
    { name: 'last month when it has 28 days', preset: 'last-month', now: new Date(2026, 2, 9), from: '2026-02-01', to: '2026-02-28' },
    { name: 'this quarter (Q4)', preset: 'this-quarter', now: new Date(2026, 10, 6), from: '2026-10-01', to: '2026-11-06' },
    { name: 'this quarter (first day of Q1)', preset: 'this-quarter', now: new Date(2026, 0, 1), from: '2026-01-01', to: '2026-01-01' },
    { name: 'year to date', preset: 'year-to-date', now: new Date(2026, 10, 6), from: '2026-01-01', to: '2026-11-06' },
    { name: 'last 12 months starts on the first of the month', preset: 'last-12-months', now: new Date(2026, 10, 6), from: '2025-12-01', to: '2026-11-06' },
    { name: 'last 12 months in January', preset: 'last-12-months', now: new Date(2026, 0, 20), from: '2025-02-01', to: '2026-01-20' },
    { name: 'custom starts on this month', preset: 'custom', now: new Date(2026, 10, 6), from: '2026-11-01', to: '2026-11-06' },
  ];

  it.each(cases)('$name', ({ preset, now, from, to }) => {
    expect(resolveReportRange(preset, now)).toEqual({ from, to });
  });

  it('offers a preset for every case the resolver knows', () => {
    expect(REPORT_RANGE_PRESETS.map((p) => p.value)).toEqual([
      'this-month',
      'last-month',
      'this-quarter',
      'year-to-date',
      'last-12-months',
      'custom',
    ]);
  });
});
