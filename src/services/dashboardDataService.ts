// Real-data payloads for dashboard widgets — one method per widget (see
// controllers/dashboard_pipeline.go on the backend), as opposed to
// dashboardWidgetService.ts, which covers widget allocation/preference.
import { tenantClient } from '@/api/tenantClient';
import type { DashboardRange, PipelineMix, PipelineMixSegment } from '@/types/dashboardData';

interface PipelineMixWire {
  success: boolean;
  range: DashboardRange;
  segments?: PipelineMixSegment[];
  closeRate: number;
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
};
