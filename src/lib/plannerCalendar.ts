// Pure date math and layout for the Activity Planner calendar: which activity
// tabs exist, and what date window and day columns each view shows. Where an
// event lands within them is lib/plannerPlacement.ts.
//
// Dates are `yyyy-mm-dd` strings and event times are zone-less wall-clock
// strings ("yyyy-mm-ddThh:mm[:ss]") — the convention of the schedule itself
// (lib/salesOrderSchedule.ts). Every calendar-day step goes through
// local-midnight Date parts, never `new Date(string)`, so a column names the
// same day in every timezone.

import { fromISODate, toISODate } from '@/lib/dateUtils';

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
/** Weeks run Sunday to Saturday, like the calendars people already use; set to
 *  1 for a Monday-first calendar. */
const WEEK_STARTS_ON = 0;
const WEEKDAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Length of the `yyyy-mm` prefix that names a month. */
const MONTH_KEY_LENGTH = 7;

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

/** The days a view is *about* around its anchor date: the day, the week, or the
 *  month itself — not the neighbouring days a month grid pads its weeks with. */
function ownRange(view: PlannerView, anchor: string): DateRange {
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

/** The days a view lays out and loads. A month is the whole grid — whole weeks,
 *  so the first and last rows carry the neighbouring months' days, and their
 *  jobs, rather than blank cells. */
export function rangeFor(view: PlannerView, anchor: string): DateRange {
  const own = ownRange(view, anchor);
  if (view !== 'month') return own;
  return { from: startOfWeek(own.from), to: addDays(startOfWeek(own.to), DAYS_PER_WEEK - 1) };
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

/** Whether `today` falls inside the window the view is about. A neighbouring
 *  month's day drawn in a month grid doesn't count: "Today" should still take
 *  you to that month. */
export function showsToday(view: PlannerView, anchor: string, today: string): boolean {
  const { from, to } = ownRange(view, anchor);
  return from <= today && today <= to;
}

/** The window's heading: "Mon, Oct 12, 2026", "Oct 11 – 17, 2026", "October 2026". */
export function rangeLabel(view: PlannerView, anchor: string): string {
  const { from, to } = ownRange(view, anchor);
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

// ── Day columns ──────────────────────────────────────────────────────────────

/** One calendar day of a view: a column of the Week and Day views, a cell of the
 *  Month grid. */
export interface PlannerColumn {
  /** The day, `yyyy-mm-dd`: unique within a view. */
  key: string;
  /** "Sun", "Mon" … */
  label: string;
  /** "Oct 12". */
  subLabel: string;
  /** The calendar day the column belongs to (the same as `key`). */
  date: string;
  dayOfMonth: number;
  /** "Oct". */
  monthAbbr: string;
  isToday: boolean;
  /** False for the days of a neighbouring month that a month grid pads its first
   *  and last weeks with; always true outside the Month view. */
  inMonth: boolean;
}

/** A column's name for people and screen readers: "Tue, Oct 12". */
export function columnName(column: PlannerColumn): string {
  return `${column.label}, ${column.subLabel}`;
}

function dayColumn(iso: string, today: string, inMonth: boolean): PlannerColumn {
  const d = toDate(iso);
  return {
    key: iso,
    label: WEEKDAY_ABBR[d.getDay()],
    subLabel: `${MONTH_ABBR[d.getMonth()]} ${d.getDate()}`,
    date: iso,
    dayOfMonth: d.getDate(),
    monthAbbr: MONTH_ABBR[d.getMonth()],
    isToday: iso === today,
    inMonth,
  };
}

/** The days a view lays out, one column each: one for Day, seven for Week, and a
 *  whole number of weeks (28–42 days) for Month. */
export function columnsFor(view: PlannerView, anchor: string, today: string): PlannerColumn[] {
  const { from, to } = rangeFor(view, anchor);
  const month = anchor.slice(0, MONTH_KEY_LENGTH);
  const columns: PlannerColumn[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) {
    columns.push(dayColumn(day, today, view !== 'month' || day.startsWith(month)));
  }
  return columns;
}

/** `days` cut into rows of seven, for a month grid. */
export function weeksOf<T>(days: readonly T[]): T[][] {
  const weeks: T[][] = [];
  for (let i = 0; i < days.length; i += DAYS_PER_WEEK) weeks.push(days.slice(i, i + DAYS_PER_WEEK));
  return weeks;
}
