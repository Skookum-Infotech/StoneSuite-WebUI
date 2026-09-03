const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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
