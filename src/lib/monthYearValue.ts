// Pure helpers behind MonthYearPicker's "yyyy-mm" value — the same shape
// <input type="month"> uses, so callers that previously wired up that input
// (e.g. CalendarSetupCard's basePeriodStart) need no change beyond the field.

export interface MonthYearValue {
  year: number;
  month: number; // 1-12
}

/** "2026-02" -> { year: 2026, month: 2 }. Returns null for anything else,
 *  including an empty string — there is no such thing as a partially valid
 *  value here. */
export function parseMonthYearValue(value: string): MonthYearValue | null {
  const match = /^(\d{4})-(\d{2})$/.exec(value);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(match[1]), month };
}

/** (2026, 2) -> "2026-02". */
export function formatMonthYearValue(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/** "2026-03" -> "2026-03-01T00:00:00.000Z" — the first instant of that month
 *  in UTC, which is what the backend's `*time.Time` JSON fields require (Go's
 *  encoding/json only accepts full RFC3339, never a bare date). Built
 *  directly from the yyyy-mm string rather than through `new Date(...)`, so
 *  it can never drift a day depending on the caller's local timezone offset
 *  the way `new Date("2026-03-01T00:00:00.000")` (no zone) followed by
 *  `.toISOString()` could. */
export function monthYearToRfc3339(value: string): string {
  return `${value}-01T00:00:00.000Z`;
}
