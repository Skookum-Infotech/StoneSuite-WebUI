// Real-data payloads for dashboard widgets — one method per widget (see
// controllers/dashboard_pipeline.go on the backend), as opposed to
// dashboardWidgetService.ts, which covers widget allocation/preference.
import { tenantClient } from '@/api/tenantClient';
import type {
  DashboardRange,
  KpiMetric,
  KpiStripData,
  PipelineMix,
  PipelineMixSegment,
  RecentRecord,
  RecentRecordsData,
} from '@/types/dashboardData';

interface PipelineMixWire {
  success: boolean;
  range: DashboardRange;
  segments?: PipelineMixSegment[];
  closeRate: number;
}

interface KpiStripWire {
  success: boolean;
  range: DashboardRange;
  metrics?: KpiMetric[];
}

interface RecentRecordsWire {
  success: boolean;
  range: DashboardRange;
  records?: RecentRecord[];
  hasMore?: boolean;
}

export const dashboardDataService = {
  getPipelineMix: (range: DashboardRange): Promise<PipelineMix> =>
    tenantClient
      .get<PipelineMixWire>('/tenant/dashboard/widgets/pipeline-donut/data', { params: { range } })
      .then((r) => ({
        range: r.data.range,
        segments: r.data.segments ?? [],
        closeRate: r.data.closeRate,
      })),

  getKpiStrip: (range: DashboardRange): Promise<KpiStripData> =>
    tenantClient
      .get<KpiStripWire>('/tenant/dashboard/widgets/kpi-strip/data', { params: { range } })
      .then((r) => ({
        range: r.data.range,
        metrics: r.data.metrics ?? [],
      })),

  getRecentRecords: (range: DashboardRange): Promise<RecentRecordsData> =>
    tenantClient
      .get<RecentRecordsWire>('/tenant/dashboard/widgets/recent-records/data', { params: { range } })
      .then((r) => ({
        range: r.data.range,
        records: r.data.records ?? [],
        hasMore: r.data.hasMore ?? false,
      })),
};
