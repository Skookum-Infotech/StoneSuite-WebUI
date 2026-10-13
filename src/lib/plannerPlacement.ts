// Where an event lands on the Activity Planner calendar: which day column it
// belongs to and, in the Week and Day views, which hour row of that day. Pure,
// like the calendar math it builds on (lib/plannerCalendar.ts).
//
// Event times are zone-less wall-clock strings ("yyyy-mm-ddThh:mm[:ss]"); only
// their date and hour parts are used, so a job sits on the same day and hour in
// every timezone.

import { splitWallClock } from '@/lib/salesOrderSchedule';
import type { PlannerColumn } from '@/lib/plannerCalendar';

// ── Hour rows ────────────────────────────────────────────────────────────────

/** The Week and Day views' rows: the shop's working hours. An event outside
 *  them sits in the nearest edge row — its chip still shows the exact time. */
const FIRST_HOUR = 6;
const LAST_HOUR = 19;
const HOURS_PER_HALF_DAY = 12;
/** The `hh` of a wall-clock `hh:mm`. */
const HOUR_DIGITS = 2;

export interface PlannerHourRow {
  hour: number;
  /** "6 AM", "12 PM". */
  label: string;
}

function hourLabel(hour: number): string {
  const suffix = hour < HOURS_PER_HALF_DAY ? 'AM' : 'PM';
  return `${hour % HOURS_PER_HALF_DAY || HOURS_PER_HALF_DAY} ${suffix}`;
}

export const PLANNER_HOUR_ROWS: readonly PlannerHourRow[] = Array.from(
  { length: LAST_HOUR - FIRST_HOUR + 1 },
  (_, i) => ({ hour: FIRST_HOUR + i, label: hourLabel(FIRST_HOUR + i) }),
);

/** The hour row (6–19) an event at `at` sits in, or null when `at` isn't a
 *  wall-clock value. */
export function hourRowFor(at: string): number | null {
  const parts = splitWallClock(at);
  if (!parts) return null;
  return Math.min(Math.max(Number(parts.time.slice(0, HOUR_DIGITS)), FIRST_HOUR), LAST_HOUR);
}

// ── Placing events ───────────────────────────────────────────────────────────

/** The day column an event at `at` belongs to (`yyyy-mm-dd`), or null when `at`
 *  isn't a wall-clock value. */
export function columnKeyFor(at: string): string | null {
  return splitWallClock(at)?.date ?? null;
}

export interface Placeable {
  /** Wall-clock `yyyy-mm-ddThh:mm[:ss]`. */
  at: string;
  /** Tiebreak for events at the same minute. */
  sortKey: string;
}

function compareText(a: string, b: string): number {
  if (a < b) return -1;
  return a > b ? 1 : 0;
}

/** Groups events by day column, soonest first inside each. Every column has an
 *  entry (possibly empty); an event outside the window is dropped. */
export function bucketByColumn<T extends Placeable>(
  events: readonly T[],
  columns: readonly PlannerColumn[],
): Map<string, T[]> {
  const buckets = new Map<string, T[]>(columns.map((c) => [c.key, []]));
  for (const event of events) {
    const key = columnKeyFor(event.at);
    const bucket = key === null ? undefined : buckets.get(key);
    if (bucket) bucket.push(event);
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => compareText(a.at, b.at) || compareText(a.sortKey, b.sortKey));
  }
  return buckets;
}

/** Splits one day's events across the hour rows, keeping their order. Every row
 *  has an entry (possibly empty); an event with no usable time is dropped. */
export function bucketByHour<T extends Placeable>(events: readonly T[]): Map<number, T[]> {
  const buckets = new Map<number, T[]>(PLANNER_HOUR_ROWS.map((row) => [row.hour, []]));
  for (const event of events) {
    const hour = hourRowFor(event.at);
    if (hour !== null) buckets.get(hour)?.push(event);
  }
  return buckets;
}
