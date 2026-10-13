// Pure helpers for the Sales Order scheduling feature: the installation-date
// guard shared by the Add/Edit forms, and wall-clock formatting for the
// Scheduling tab.
//
// The schedule's date-times are zone-less wall-clock strings
// ("yyyy-mm-ddThh:mm:ss") — what the shop floor reads off a clock, not an
// instant. Everything here works on their parts and never goes through
// `new Date(string)`, so a value renders the same in every timezone.

import { fromISODate, toISODate } from '@/lib/dateUtils';
import type { SalesOrderScheduleActivity, ScheduleActivityStatus } from '@/types/salesOrder';

// ── Installation date guard ──────────────────────────────────────────────────

export const INSTALL_DATE_REQUIRED_MESSAGE = 'Select a scheduled installation date.';
export const INSTALL_DATE_INVALID_MESSAGE = 'Enter a valid scheduled installation date.';
export const INSTALL_DATE_PAST_MESSAGE = 'The scheduled installation date cannot be in the past.';

/** The first selectable installation date: today, in the viewer's own zone. */
export function earliestInstallDate(now: Date = new Date()): string {
  return toISODate(now);
}

/** Why `value` can't be saved as the scheduled installation date, or '' when it
 *  can. `savedValue` is the date already on the order: leaving it untouched stays
 *  valid even after it has slipped into the past, so an old order can still be
 *  edited — only a *different* date is held to "today or later". */
export function installDateError(value: unknown, savedValue?: string, now: Date = new Date()): string {
  const iso = typeof value === 'string' ? value.trim() : '';
  if (!iso) return INSTALL_DATE_REQUIRED_MESSAGE;
  if (!fromISODate(iso)) return INSTALL_DATE_INVALID_MESSAGE;
  if (savedValue && iso === savedValue) return '';
  // ISO dates order the same as the calendar days they name.
  return iso < earliestInstallDate(now) ? INSTALL_DATE_PAST_MESSAGE : '';
}

// ── Wall-clock values ────────────────────────────────────────────────────────

const WALL_CLOCK_RE = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const HOURS_PER_HALF_DAY = 12;

export interface WallClockParts {
  /** `yyyy-mm-dd` */
  date: string;
  /** `hh:mm`, 24-hour */
  time: string;
}

/** Splits a wall-clock string into its date and time, or null if it isn't one. */
export function splitWallClock(value?: string): WallClockParts | null {
  const m = value ? WALL_CLOCK_RE.exec(value) : null;
  return m ? { date: m[1], time: `${m[2]}:${m[3]}` } : null;
}

/** Joins a date and time back into the `yyyy-mm-ddThh:mm` form the API takes. */
export function joinWallClock(date: string, time: string): string {
  return `${date}T${time}`;
}

/** "9:00 AM" from a 24-hour `hh:mm`. */
function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const suffix = h < HOURS_PER_HALF_DAY ? 'AM' : 'PM';
  return `${h % HOURS_PER_HALF_DAY || HOURS_PER_HALF_DAY}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** "Nov 10, 2026, 9:00 AM", or '' when the value isn't a wall-clock string. */
export function formatWallClock(value?: string): string {
  const parts = splitWallClock(value);
  if (!parts) return '';
  const [year, month, day] = parts.date.split('-').map(Number);
  const monthName = MONTH_ABBR[month - 1];
  if (!monthName) return '';
  return `${monthName} ${day}, ${year}, ${formatTime(parts.time)}`;
}

/** "9:00 AM" from a wall-clock value, or '' when it isn't one. */
export function formatWallClockTime(value?: string): string {
  const parts = splitWallClock(value);
  return parts ? formatTime(parts.time) : '';
}

/** The viewer's current local time as a `yyyy-mm-ddThh:mm` wall-clock string. */
export function wallClockNow(now: Date = new Date()): string {
  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  return joinWallClock(toISODate(now), `${hh}:${mm}`);
}

// ── Row status ───────────────────────────────────────────────────────────────

/** What a row shows: the stored status, or "overdue" for a pending row whose
 *  time has passed. */
export type ScheduleDisplayStatus = ScheduleActivityStatus | 'overdue';

export const SCHEDULE_STATUS_LABELS: Record<ScheduleDisplayStatus, string> = {
  pending: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
  overdue: 'Overdue',
};

export const SCHEDULE_STATUS_COLORS: Record<ScheduleDisplayStatus, string> = {
  pending: '#3b82f6',
  in_progress: '#f59e0b',
  completed: '#10b981',
  overdue: '#ef4444',
};

/** Wall-clock strings sort the same as the moments they name, so comparing the
 *  `yyyy-mm-ddThh:mm` prefixes is a correct "has this time passed" check.
 *
 *  Only a `pending` row can be overdue: the scheduled time is when the activity
 *  is meant to begin, so one that someone has started is on its way and one that
 *  is completed is done. */
export function displayStatus(
  activity: Pick<SalesOrderScheduleActivity, 'status' | 'scheduledAt'>,
  now: Date = new Date(),
): ScheduleDisplayStatus {
  if (activity.status !== 'pending') return activity.status;
  const parts = splitWallClock(activity.scheduledAt);
  if (!parts) return 'pending';
  return joinWallClock(parts.date, parts.time) < wallClockNow(now) ? 'overdue' : 'pending';
}

export interface ScheduleProgress {
  total: number;
  completed: number;
  inProgress: number;
  overdue: number;
}

export function scheduleProgress(
  activities: readonly SalesOrderScheduleActivity[],
  now: Date = new Date(),
): ScheduleProgress {
  let completed = 0;
  let inProgress = 0;
  let overdue = 0;
  for (const a of activities) {
    const status = displayStatus(a, now);
    if (status === 'completed') completed += 1;
    else if (status === 'in_progress') inProgress += 1;
    else if (status === 'overdue') overdue += 1;
  }
  return { total: activities.length, completed, inProgress, overdue };
}
