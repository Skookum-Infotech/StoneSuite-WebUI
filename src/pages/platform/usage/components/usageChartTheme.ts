// Recharts takes colours as props, so the Tenant Usage chart colours live here.
export { AXIS_COLOR, AXIS_FONT_SIZE, GRID_COLOR } from '@/pages/reports/components/reportChartTheme';

export const REQUEST_COLOR = '#719c3b';
export const JOB_COLOR = '#0f766e';
export const DB_COLOR = '#719c3b';
export const R2_COLOR = '#0f766e';
export const USAGE_CHART_HEIGHT = 220;
export const AREA_FILL_OPACITY = 0.45;
export const LINE_FILL_OPACITY = 0.12;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "2026-11-25" → "Nov 25" (UTC, the series' own calendar). */
export function shortDate(isoDate: string): string {
  const [, month, day] = isoDate.split('-').map(Number);
  return month && day ? `${MONTHS[month - 1]} ${day}` : isoDate;
}
