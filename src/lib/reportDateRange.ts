import { toISODate } from '@/lib/dateUtils';

export type ReportRangePreset =
  | 'this-month'
  | 'last-month'
  | 'this-quarter'
  | 'year-to-date'
  | 'last-12-months'
  | 'custom';

export const REPORT_RANGE_PRESETS: { value: ReportRangePreset; label: string }[] = [
  { value: 'this-month', label: 'This month' },
  { value: 'last-month', label: 'Last month' },
  { value: 'this-quarter', label: 'This quarter' },
  { value: 'year-to-date', label: 'Year to date' },
  { value: 'last-12-months', label: 'Last 12 months' },
  { value: 'custom', label: 'Custom' },
];

export const DEFAULT_REPORT_PRESET: ReportRangePreset = 'year-to-date';

const MONTHS_PER_QUARTER = 3;
const MONTHS_PER_YEAR = 12;

export interface ReportDateRange {
  /** ISO `yyyy-mm-dd`, inclusive. */
  from: string;
  /** ISO `yyyy-mm-dd`, inclusive. */
  to: string;
}

/** Resolves a preset to its inclusive calendar window relative to `now`
 *  (local time). `custom` has no window of its own: it returns this month so
 *  the pickers start on something sensible. */
export function resolveReportRange(preset: ReportRangePreset, now: Date): ReportDateRange {
  const year = now.getFullYear();
  const month = now.getMonth();
  switch (preset) {
    case 'last-month':
      return { from: toISODate(new Date(year, month - 1, 1)), to: toISODate(new Date(year, month, 0)) };
    case 'this-quarter': {
      const quarterStart = month - (month % MONTHS_PER_QUARTER);
      return { from: toISODate(new Date(year, quarterStart, 1)), to: toISODate(now) };
    }
    case 'year-to-date':
      return { from: toISODate(new Date(year, 0, 1)), to: toISODate(now) };
    case 'last-12-months':
      // Whole months: from the first day of the same month last year, so every
      // bucket in a monthly trend is a complete month except the current one.
      return { from: toISODate(new Date(year, month - (MONTHS_PER_YEAR - 1), 1)), to: toISODate(now) };
    case 'this-month':
    case 'custom':
    default:
      return { from: toISODate(new Date(year, month, 1)), to: toISODate(now) };
  }
}
