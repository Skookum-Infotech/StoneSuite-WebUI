import { formatBreadcrumbSegment } from './breadcrumb';
import type { RecentRecord } from '@/types/dashboardData';

/**
 * Maps Recent records widget rows into CSV cell rows for the console's
 * Download CSV button (see DashboardPage.tsx). Reuses formatBreadcrumbSegment
 * for the type label so the exported "Type" column matches the badge label
 * shown on screen instead of the raw module key.
 */
export function recentRecordsToCsvRows(records: RecentRecord[]): string[][] {
  return records.map((r) => [
    formatBreadcrumbSegment(r.module),
    r.recordNumber,
    r.account ?? '',
    r.value === null ? '' : String(r.value),
    r.status,
    r.updatedAt,
  ]);
}
