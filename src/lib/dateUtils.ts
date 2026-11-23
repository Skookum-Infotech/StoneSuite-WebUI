const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// A Postgres DATE the backend scanned into a Go time.Time arrives as exact UTC
// midnight. A real timestamptz carries microseconds, so landing precisely on
// 00:00:00.000 UTC is the date-only signature in practice.
const UTC_MIDNIGHT_RE = /^(\d{4}-\d{2}-\d{2})T00:00:00(?:\.0+)?(?:Z|[+-]00:?00)$/;

/** Format a Date as a local `yyyy-mm-dd` string (no UTC conversion, unlike
 *  `toISOString()`, which would shift the date near a timezone boundary). */
export function toISODate(date: Date): string {
  const year = String(date.getFullYear()).padStart(4, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Parse a `yyyy-mm-dd` string into a local midnight Date. Built from parts
 *  (not `new Date(iso)`) so it lands on the same calendar day in every
 *  timezone — `new Date('2026-08-19')` parses as UTC midnight, which renders
 *  as Aug 18 in any timezone west of UTC. Returns null for anything that
 *  isn't a well-formed, valid calendar date. */
export function fromISODate(iso: string): Date | null {
  if (!ISO_DATE_RE.test(iso)) return null;
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

/** Short human-readable form of an ISO date, e.g. "Aug 19, 2026". Empty
 *  string for an empty or malformed input, so callers can render it directly
 *  without a conditional. */
export function formatDisplayDate(iso: string): string {
  const date = fromISODate(iso);
  if (!date) return '';
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Date format for list and table columns, e.g. "Aug 19, 2026". A four-digit year
 *  keeps "Sep 5, 30" from being read as 2030 or 1930. */
export const LIST_DATE_OPTIONS: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };

/** Parse a date value from the API. A Postgres DATE -- a bare `yyyy-mm-dd`,
 *  or the exact-UTC-midnight form the Go modules emit via time.Time
 *  (`2026-01-02T00:00:00Z`) -- becomes local midnight on that calendar day via
 *  `fromISODate`; any other timestamp goes through `new Date` unchanged, since
 *  it names an instant and should render in the viewer's zone. Null for an
 *  empty or unparseable value. */
export function parseDateValue(value: string | null | undefined): Date | null {
  if (!value) return null;
  if (ISO_DATE_RE.test(value)) return fromISODate(value);
  const midnight = UTC_MIDNIGHT_RE.exec(value);
  if (midnight) return fromISODate(midnight[1]);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** `toLocaleDateString` for an API date value that keeps date-only values on
 *  their calendar day in every timezone. Mirrors the native argument order so
 *  `new Date(v).toLocaleDateString(locale, opts)` swaps in directly. Empty
 *  string for an empty or unparseable value. */
export function formatDateValue(
  value: string | null | undefined,
  locale?: string,
  options?: Intl.DateTimeFormatOptions,
): string {
  const date = parseDateValue(value);
  return date ? date.toLocaleDateString(locale, options) : '';
}

/** The `yyyy-mm-dd` part of a Postgres DATE that the backend serialised
 *  through `time.Time` (`2026-01-02T00:00:00Z`). Only for values known to be
 *  DATE columns: on a real timestamp this keeps the UTC day, not the viewer's.
 *  Empty string when the value doesn't start with a date. */
export function datePart(value: string | null | undefined): string {
  const head = value?.slice(0, 10) ?? '';
  return ISO_DATE_RE.test(head) ? head : '';
}
