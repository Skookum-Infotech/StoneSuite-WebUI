import { describe, it, expect } from 'vitest';
import { parseMonthYearValue, formatMonthYearValue, monthYearToRfc3339 } from './monthYearValue';

describe('parseMonthYearValue', () => {
  it('parses a well-formed yyyy-mm value', () => {
    expect(parseMonthYearValue('2026-02')).toEqual({ year: 2026, month: 2 });
  });

  it.each(['', '2026', '2026-2', '2026/02', 'not-a-date', '2026-00', '2026-13'])(
    'returns null for %p',
    (value) => {
      expect(parseMonthYearValue(value)).toBeNull();
    },
  );
});

describe('formatMonthYearValue', () => {
  it('zero-pads single-digit months', () => {
    expect(formatMonthYearValue(2026, 2)).toBe('2026-02');
  });

  it('leaves double-digit months as-is', () => {
    expect(formatMonthYearValue(2026, 12)).toBe('2026-12');
  });

  it('round-trips through parseMonthYearValue', () => {
    const formatted = formatMonthYearValue(2025, 7);
    expect(parseMonthYearValue(formatted)).toEqual({ year: 2025, month: 7 });
  });
});

describe('monthYearToRfc3339', () => {
  it('produces a full RFC3339 UTC instant at the first of the month', () => {
    expect(monthYearToRfc3339('2026-03')).toBe('2026-03-01T00:00:00.000Z');
  });

  it('produces a value Go\'s time.Time JSON unmarshaling accepts', () => {
    // Date correctly parses it back with no timezone drift, unlike the bare
    // "2026-03-01" this replaced, which Go's encoding/json rejects outright.
    const d = new Date(monthYearToRfc3339('2026-12'));
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(11); // 0-indexed
    expect(d.getUTCDate()).toBe(1);
  });
});
