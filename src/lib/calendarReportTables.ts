import type { ReportTable } from '@/lib/reportExport';
import { formatDateValue } from '@/lib/dateUtils';
import { formatPercent, formatPeriodLabel, formatReportDate } from '@/lib/reportFormat';
import type {
  CalendarReport,
  CalendarWindowParams,
  InstallSource,
  LeadTimeRow,
  LeadTimeTotals,
  OnTimeRow,
  OnTimeTotals,
  OverdueActivity,
  OverdueTotals,
  UpcomingInstallsReport,
} from '@/types/reports';

const NO_VALUE = '—';
const DAYS_DECIMALS = 1;
const TOTALS_LABEL = 'Total';

export const INSTALL_SOURCE_LABELS: Record<InstallSource, string> = {
  appointment: 'Booked visit',
  plan: 'Planned date',
};

export const UPCOMING_WEEK_OPTIONS = [4, 8, 12, 26];
export const DEFAULT_UPCOMING_WEEKS = 8;

/** "8.5" — a days figure with one decimal. */
export function formatDayCount(days: number): string {
  return days.toFixed(DAYS_DECIMALS);
}

/** "Due today" / "1 day" / "12 days" — how long an activity has been overdue. */
export function formatOverdueDays(days: number): string {
  if (days <= 0) return 'Due today';
  return days === 1 ? '1 day' : `${days} days`;
}

/** Average days late, or a dash when nothing was late. */
export function formatAvgLate(days: number | null): string {
  return days === null ? NO_VALUE : formatDayCount(days);
}

/** "Week of Nov 9" for a Monday-start week. */
export function formatWeekLabel(weekStart: string): string {
  return `Week of ${formatDateValue(weekStart, undefined, { month: 'short', day: 'numeric' })}`;
}

/** Install date with its weekday: "Tue, Nov 10, 2026". */
export function formatInstallDay(iso: string): string {
  return formatDateValue(iso, undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}

export function upcomingReportTable(report: UpcomingInstallsReport): ReportTable {
  return {
    title: 'Upcoming Installs',
    subtitle: `Installs in the next ${report.weeks} weeks · booked visits, or the planned Installation date for orders with none booked`,
    headers: ['Date', 'Order', 'Customer', 'Source', 'Crew lead'],
    rows: report.rows.map((r) => [formatInstallDay(r.day), r.order, r.customer, INSTALL_SOURCE_LABELS[r.source], r.lead || NO_VALUE]),
  };
}

export function overdueReportTable(report: CalendarReport<OverdueActivity, OverdueTotals>): ReportTable {
  return {
    title: 'Overdue Activities',
    subtitle: 'Pending order activities whose scheduled time has passed, as of now',
    headers: ['Order', 'Customer', 'Order status', 'Activity', 'Scheduled', 'Days overdue'],
    rows: report.rows.map((r) => [r.order, r.customer, r.orderStatus, r.activity, formatReportDate(r.scheduledAt), formatOverdueDays(r.daysOverdue)]),
  };
}

export function onTimeReportTable(report: CalendarReport<OnTimeRow, OnTimeTotals>, params: CalendarWindowParams): ReportTable {
  const t = report.totals;
  return {
    title: 'On-time Completion',
    subtitle: `Activities completed ${formatReportDate(params.from)} to ${formatReportDate(params.to)} · on time means finished on or before the scheduled day`,
    headers: ['Activity', 'Completed', 'On time', 'Late', 'On-time %', 'Avg days late'],
    rows: report.rows.map((r) => [r.activity, String(r.completed), String(r.onTime), String(r.late), formatPercent(r.onTimePercent), formatAvgLate(r.avgDaysLate)]),
    totalsRow: [TOTALS_LABEL, String(t.completed), String(t.onTime), String(t.late), formatPercent(t.onTimePercent), ''],
  };
}

export function leadTimeReportTable(report: CalendarReport<LeadTimeRow, LeadTimeTotals>, params: CalendarWindowParams): ReportTable {
  const t = report.totals;
  return {
    title: 'Order-to-Install Lead Time',
    subtitle: `Installs completed ${formatReportDate(params.from)} to ${formatReportDate(params.to)} · days from the order date to the completed install`,
    headers: ['Month', 'Orders installed', 'Avg days', 'Median days', 'Fastest', 'Slowest'],
    rows: report.rows.map((r) => [
      formatPeriodLabel(r.period, 'month'),
      String(r.orders),
      formatDayCount(r.avgDays),
      formatDayCount(r.medianDays),
      String(r.minDays),
      String(r.maxDays),
    ]),
    totalsRow: [TOTALS_LABEL, String(t.orders), formatDayCount(t.avgDays), '', String(t.minDays), String(t.maxDays)],
  };
}
