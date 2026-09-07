import { describe, it, expect } from 'vitest';
import { toISODate, fromISODate, formatDisplayDate } from './dateUtils';

describe('toISODate', () => {
  it.each([
    ['a plain date', new Date(2026, 7, 19), '2026-08-19'],
    ['a single-digit month and day', new Date(2026, 0, 5), '2026-01-05'],
    ['the last day of December', new Date(2025, 11, 31), '2025-12-31'],
  ])('%s', (_name, date, expected) => {
    expect(toISODate(date)).toBe(expected);
  });
});

describe('fromISODate', () => {
  it('parses an ISO date string into a local Date at midnight', () => {
    const date = fromISODate('2026-08-19');
    expect(date).not.toBeNull();
    expect(date!.getFullYear()).toBe(2026);
    expect(date!.getMonth()).toBe(7); // 0-indexed
    expect(date!.getDate()).toBe(19);
    expect(date!.getHours()).toBe(0);
  });

  it('returns null for an empty string', () => {
    expect(fromISODate('')).toBeNull();
  });

  it('returns null for a malformed string', () => {
    expect(fromISODate('not-a-date')).toBeNull();
  });

  it('round-trips with toISODate', () => {
    const iso = '2026-01-05';
    expect(toISODate(fromISODate(iso)!)).toBe(iso);
  });
});

describe('formatDisplayDate', () => {
  it('formats an ISO date as a short human-readable string', () => {
    expect(formatDisplayDate('2026-08-19')).toBe('Aug 19, 2026');
  });

  it('returns an empty string for an empty input', () => {
    expect(formatDisplayDate('')).toBe('');
  });

  it('returns an empty string for a malformed input', () => {
    expect(formatDisplayDate('not-a-date')).toBe('');
  });
});
