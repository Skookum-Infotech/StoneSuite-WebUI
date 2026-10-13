// Pure date math and layout for the Activity Planner calendar: which activity
// tabs exist, what date window and columns each view shows, and which column
// an event lands in.
//
// Dates are `yyyy-mm-dd` strings and event times are zone-less wall-clock
// strings ("yyyy-mm-ddThh:mm[:ss]") — the convention of the schedule itself
// (lib/salesOrderSchedule.ts). Every calendar-day step goes through
// local-midnight Date parts, never `new Date(string)`, so a column names the
// same day in every timezone.

import { fromISODate, toISODate } from '@/lib/dateUtils';
import { splitWallClock } from '@/lib/salesOrderSchedule';

// ── Activities (the tabs) ────────────────────────────────────────────────────

/** One tab. A `schedule` tab reads that group's planned activities off every
 *  order's schedule; the `invoice` tab lists the invoices made from orders. */
export type PlannerActivity =
  | { key: string; label: string; source: 'schedule'; group: string }
  | { key: string; label: string; source: 'invoice' };

export const PLANNER_ACTIVITIES: readonly PlannerActivity[] = [
  { key: 'template', label: 'Template', source: 'schedule', group: 'Template' },
  { key: 'engineering', label: 'Engineering', source: 'schedule', group: 'Engineering' },
  // An order's schedule names this phase "WIP Bin Transfer".
  { key: 'bin-transfer', label: 'Bin Transfer', source: 'schedule', group: 'WIP Bin Transfer' },
  { key: 'saw', label: 'Saw', source: 'schedule', group: 'Saw' },
  { key: 'edges', label: 'Edges', source: 'schedule', group: 'Edges' },
  { key: 'quality-control', label: 'Quality Control', source: 'schedule', group: 'Quality Control' },
  { key: 'installation', label: 'Installation', source: 'schedule', group: 'Installation' },
  { key: 'invoicing', label: 'Invoicing', source: 'invoice' },
];

/** Query-key root of every calendar window. Anything that changes an order's
 *  schedule invalidates this prefix, so the planner never shows a stale plan. */
export const PLANNER_QUERY_KEY = 'activity-planner';

/** DOM id of the tab panel the tabs control, and of each tab (for aria-labelledby). */
export const PLANNER_PANEL_ID = 'planner-panel';
export function plannerTabId(activityKey: string): string {
  return `planner-tab-${activityKey}`;
}

// ── Views ────────────────────────────────────────────────────────────────────

export type PlannerView = 'day' | 'week' | 'month';

export const PLANNER_VIEWS: readonly { key: PlannerView; label: string }[] = [
  { key: 'day', label: 'Day' },
  { key: 'week', label: 'Week' },
  { key: 'month', label: 'Month' },
];

export const DEFAULT_PLANNER_VIEW: PlannerView = 'week';

/** The view named by a URL value, or the default for anything else. */
export function parseView(raw: string | null | undefined): PlannerView {
  return PLANNER_VIEWS.find((v) => v.key === raw)?.key ?? DEFAULT_PLANNER_VIEW;
}

/** The anchor date named by a URL value, or `fallback` when it isn't a real date. */
export function parseAnchor(raw: string | null | undefined, fallback: string): string {
  return raw && fromISODate(raw) ? raw : fallback;
}

// ── Date arithmetic ──────────────────────────────────────────────────────────

const DAYS_PER_WEEK = 7;
/** Weeks run Monday to Sunday; set to 0 for a Sunday-first calendar. */
const WEEK_STARTS_ON = 1;
const SATURDAY = 6;
const SUNDAY = 0;
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** `iso` as a local-midnight Date; today if it isn't a real date, so a bad URL
 *  value can never throw while rendering. */
function toDate(iso: string): Date {
  const parsed = fromISODate(iso);
  if (parsed) return parsed;
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function addDays(iso: string, days: number): string {
  const d = toDate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), d.getDate() + days));
}

export function startOfWeek(iso: string): string {
  const back = (toDate(iso).getDay() - WEEK_STARTS_ON + DAYS_PER_WEEK) % DAYS_PER_WEEK;
  return addDays(iso, -back);
}

export function startOfMonth(iso: string): string {
  const d = toDate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth(), 1));
}

export function endOfMonth(iso: string): string {
  const d = toDate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

/** The first day of the month `months` away from `iso`'s month. */
function addMonths(iso: string, months: number): string {
  const d = toDate(iso);
  return toISODate(new Date(d.getFullYear(), d.getMonth() + months, 1));
}

// ── Window and navigation ────────────────────────────────────────────────────

/** An inclusive window of calendar days. */
export interface DateRange {
  from: string;
  to: string;
}

/** The days a view shows around its anchor date. */
export function rangeFor(view: PlannerView, anchor: string): DateRange {
  switch (view) {
    case 'day':
      return { from: anchor, to: anchor };
    case 'week': {
      const from = startOfWeek(anchor);
      return { from, to: addDays(from, DAYS_PER_WEEK - 1) };
    }
    case 'month':
      return { from: startOfMonth(anchor), to: endOfMonth(anchor) };
  }
}

/** Moves the anchor one view-unit back (-1) or forward (+1). A month step lands
 *  on the 1st, so the 31st never overflows into a month two away. */
export function shiftAnchor(view: PlannerView, anchor: string, direction: -1 | 1): string {
  switch (view) {
    case 'day':
      return addDays(anchor, direction);
    case 'week':
      return addDays(anchor, direction * DAYS_PER_WEEK);
    case 'month':
      return addMonths(anchor, direction);
  }
}

/** Whether `today` falls inside the window the view shows. */
export function showsToday(view: PlannerView, anchor: string, today: string): boolean {
  const { from, to } = rangeFor(view, anchor);
  return from <= today && today <= to;
}

/** The window's heading: "Mon, Oct 12, 2026", "Oct 12 – 18, 2026", "October 2026". */
export function rangeLabel(view: PlannerView, anchor: string): string {
  const { from, to } = rangeFor(view, anchor);
  const a = toDate(from);
  const b = toDate(to);
  switch (view) {
    case 'day':
      return `${WEEKDAY_ABBR[a.getDay()]}, ${MONTH_ABBR[a.getMonth()]} ${a.getDate()}, ${a.getFullYear()}`;
    case 'month':
      return `${MONTH_NAMES[a.getMonth()]} ${a.getFullYear()}`;
    case 'week': {
      const start = `${MONTH_ABBR[a.getMonth()]} ${a.getDate()}`;
      if (a.getFullYear() !== b.getFullYear()) {
        return `${start}, ${a.getFullYear()} – ${MONTH_ABBR[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
      }
      if (a.getMonth() !== b.getMonth()) {
        return `${start} – ${MONTH_ABBR[b.getMonth()]} ${b.getDate()}, ${b.getFullYear()}`;
      }
      return `${start} – ${b.getDate()}, ${b.getFullYear()}`;
    }
  }
}

// ── Columns ──────────────────────────────────────────────────────────────────

/** The Day view's hourly columns: the shop's working hours. An event outside
 *  them lands in the nearest edge column — its card still shows the exact time. */
const DAY_VIEW_FIRST_HOUR = 6;
const DAY_VIEW_LAST_HOUR = 19;
const HOURS_PER_HALF_DAY = 12;
const ALL_DAY_LABEL = 'All day';

export interface PlannerColumn {
  /** Unique within a view: `yyyy-mm-dd`, or `yyyy-mm-ddThh` for an hour. */
  key: string;
  /** Header line one: "Mon", "9 AM", "All day". */
  label: string;
  /** Header line two: "Oct 12" (blank for an hour). */
  subLabel: string;
  /** The calendar day the column belongs to. */
  date: string;
  isToday: boolean;
  isWeekend: boolean;
}

/** A column's name for people and screen readers: "Tue, Oct 12", "9 AM", "All day". */
export function columnName(column: PlannerColumn): string {
  return column.subLabel ? `${column.label}, ${column.subLabel}` : column.label;
}

function dayColumn(iso: string, today: string): PlannerColumn {
  const d = toDate(iso);
  const dow = d.getDay();
  return {
    key: iso,
    label: WEEKDAY_ABBR[dow],
    subLabel: `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`,
    date: iso,
    isToday: iso === today,
    isWeekend: dow === SUNDAY || dow === SATURDAY,
  };
}

function hourLabel(hour: number): string {
  const suffix = hour < HOURS_PER_HALF_DAY ? 'AM' : 'PM';
  return `${hour % HOURS_PER_HALF_DAY || HOURS_PER_HALF_DAY} ${suffix}`;
}

function hourKey(date: string, hour: number): string {
  return `${date}T${String(hour).padStart(2, '0')}`;
}

/** The columns a view lays out. `timed` is false for a source whose events have
 *  no time of day (invoices): its Day view is one "All day" column, not hours. */
export function columnsFor(view: PlannerView, anchor: string, today: string, timed = true): PlannerColumn[] {
  if (view === 'day') {
    const base = dayColumn(anchor, today);
    if (!timed) return [{ ...base, label: ALL_DAY_LABEL, subLabel: '' }];
    const columns: PlannerColumn[] = [];
    for (let hour = DAY_VIEW_FIRST_HOUR; hour <= DAY_VIEW_LAST_HOUR; hour += 1) {
      columns.push({
        ...base,
        key: hourKey(anchor, hour),
        label: hourLabel(hour),
        subLabel: '',
        isToday: false,
        isWeekend: false,
      });
    }
    return columns;
  }
  const { from, to } = rangeFor(view, anchor);
  const columns: PlannerColumn[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) columns.push(dayColumn(day, today));
  return columns;
}

// ── Placing events ───────────────────────────────────────────────────────────

/** The key of the column an event at `at` belongs to, or null when `at` isn't a
 *  wall-clock value. */
export function columnKeyFor(view: PlannerView, at: string, timed = true): string | null {
  const parts = splitWallClock(at);
  if (!parts) return null;
  if (view !== 'day' || !timed) return parts.date;
  const hour = Number(parts.time.slice(0, 2));
  return hourKey(parts.date, Math.min(Math.max(hour, DAY_VIEW_FIRST_HOUR), DAY_VIEW_LAST_HOUR));
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

/** Groups events by column, soonest first inside each. Every column has an entry
 *  (possibly empty); an event outside the window is dropped. */
export function bucketByColumn<T extends Placeable>(
  events: readonly T[],
  view: PlannerView,
  columns: readonly PlannerColumn[],
  timed = true,
): Map<string, T[]> {
  const buckets = new Map<string, T[]>(columns.map((c) => [c.key, []]));
  for (const event of events) {
    const key = columnKeyFor(view, event.at, timed);
    const bucket = key === null ? undefined : buckets.get(key);
    if (bucket) bucket.push(event);
  }
  for (const bucket of buckets.values()) {
    bucket.sort((a, b) => compareText(a.at, b.at) || compareText(a.sortKey, b.sortKey));
  }
  return buckets;
}
