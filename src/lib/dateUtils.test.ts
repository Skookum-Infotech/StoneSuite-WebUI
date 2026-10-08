import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { toISODate, fromISODate, formatDisplayDate, parseDateValue, formatDateValue, datePart, LIST_DATE_OPTIONS } from './dateUtils';

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

// Pinned to a zone west of UTC, where a bare `yyyy-mm-dd` parsed by `new Date`
// (UTC midnight) renders as the previous day. Node re-reads TZ on assignment.
describe('date values in America/Chicago', () => {
  const SHORT: Intl.DateTimeFormatOptions = LIST_DATE_OPTIONS;
  let originalTZ: string | undefined;

  beforeAll(() => {
    originalTZ = process.env.TZ;
    process.env.TZ = 'America/Chicago';
  });

  afterAll(() => {
    if (originalTZ === undefined) delete process.env.TZ;
    else process.env.TZ = originalTZ;
  });

  it('reproduces the off-by-one with a naive new Date (guards the TZ pin)', () => {
    expect(new Date('2026-01-02').getDate()).toBe(1);
  });

  describe('parseDateValue', () => {
    it.each([
      ['a date-only value lands on its calendar day', '2026-01-02', [2026, 0, 2]],
      ['a date-only value at a year boundary', '2026-01-01', [2026, 0, 1]],
      ['a DATE sent as UTC midnight keeps its calendar day', '2026-01-02T00:00:00Z', [2026, 0, 2]],
      ['UTC midnight with milliseconds', '2026-01-02T00:00:00.000Z', [2026, 0, 2]],
      ['UTC midnight with a +00:00 offset', '2026-01-02T00:00:00+00:00', [2026, 0, 2]],
      ['a UTC timestamp converts to the local instant', '2026-01-02T03:00:00Z', [2026, 0, 1]],
      ['one microsecond past UTC midnight is a real instant', '2026-01-02T00:00:00.000001Z', [2026, 0, 1]],
      ['local midnight in another offset is a real instant', '2026-01-02T00:00:00-06:00', [2026, 0, 2]],
      ['an offset timestamp converts to the local instant', '2026-01-02T12:00:00-06:00', [2026, 0, 2]],
    ])('%s', (_name, value, [y, m, d]) => {
      const date = parseDateValue(value);
      expect([date?.getFullYear(), date?.getMonth(), date?.getDate()]).toEqual([y, m, d]);
    });

    it.each([
      ['undefined', undefined],
      ['null', null],
      ['an empty string', ''],
      ['garbage', 'not-a-date'],
      ['an impossible calendar date', '2026-02-30'],
    ])('returns null for %s', (_name, value) => {
      expect(parseDateValue(value)).toBeNull();
    });
  });

  describe('datePart', () => {
    it.each([
      ['a DATE serialised through time.Time', '2026-01-02T00:00:00Z', '2026-01-02'],
      ['an already date-only value', '2026-01-02', '2026-01-02'],
      ['undefined', undefined, ''],
      ['an empty string', '', ''],
      ['garbage', 'not-a-date', ''],
    ])('%s', (_name, value, expected) => {
      expect(datePart(value)).toBe(expected);
    });

    it('formats on the stored day where new Date would slip a day', () => {
      const value = '2026-01-02T00:00:00Z';
      expect(new Date(value).getDate()).toBe(1);
      expect(formatDateValue(datePart(value), 'en-US', SHORT)).toBe('Jan 2, 2026');
    });
  });

  describe('formatDateValue', () => {
    it.each([
      ['a sales-order date-only value', '2026-01-02', 'en-US', SHORT, 'Jan 2, 2026'],
      ['a long-form date-only value', '2026-12-31', 'en-US', { year: 'numeric', month: 'short', day: 'numeric' } as const, 'Dec 31, 2026'],
      ['a payment date sent as UTC midnight', '2026-01-02T00:00:00Z', 'en-US', SHORT, 'Jan 2, 2026'],
      ['a UTC timestamp just after midnight', '2026-01-02T03:00:00Z', 'en-US', SHORT, 'Jan 1, 2026'],
      ['an empty value', '', 'en-US', SHORT, ''],
      ['an unparseable value', 'nope', 'en-US', SHORT, ''],
    ])('%s', (_name, value, locale, options, expected) => {
      expect(formatDateValue(value, locale, options)).toBe(expected);
    });
  });
});

describe('LIST_DATE_OPTIONS', () => {
  it.each([
    ['a current-century date', '2026-09-05', 'Sep 5, 2026'],
    ['a far-future date a two-digit year would blur', '2030-09-05', 'Sep 5, 2030'],
    ['a last-century date a two-digit year would blur', '1997-08-16', 'Aug 16, 1997'],
  ])('keeps the full year for %s', (_name, iso, expected) => {
    expect(formatDateValue(iso, 'en-US', LIST_DATE_OPTIONS)).toBe(expected);
  });
});
