import { formatDateValue } from '@/lib/dateUtils';

/** Formats an ISO date for the fabrication job detail views; em dash when absent. */
export function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return formatDateValue(iso, undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
