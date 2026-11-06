import { formatDateValue } from '@/lib/dateUtils';
import type { TrendBucket } from '@/types/reports';

const PERCENT_DECIMALS = 1;
const QUANTITY_DECIMALS = 2;
const NO_VALUE = '—';

/** "12.5%" — a report-wide percent with one decimal. */
export function formatPercent(value: number): string {
  return `${value.toFixed(PERCENT_DECIMALS)}%`;
}

/** Quantities in report tables: up to two decimals, thousands separators. */
export function formatQuantity(value: number): string {
  return value.toLocaleString(undefined, { maximumFractionDigits: QUANTITY_DECIMALS });
}

/** Date cell: "Jan 5, 2026", or an em dash when the report has no date. */
export function formatReportDate(iso: string | null | undefined): string {
  if (!iso) return NO_VALUE;
  return formatDateValue(iso, undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

/** Axis/table label for a trend bucket's first day: "Jan 2026" for months,
 *  "Week of Jan 5" for weeks. */
export function formatPeriodLabel(period: string, bucket: TrendBucket): string {
  if (bucket === 'week') {
    return `Week of ${formatDateValue(period, undefined, { month: 'short', day: 'numeric' })}`;
  }
  return formatDateValue(period, undefined, { month: 'short', year: 'numeric' });
}
