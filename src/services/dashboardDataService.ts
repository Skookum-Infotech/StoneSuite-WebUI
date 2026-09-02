// Real-data payloads for dashboard widgets — one method per widget (see
// controllers/dashboard_pipeline.go on the backend), as opposed to
// dashboardWidgetService.ts, which covers widget allocation/preference.
import { tenantClient } from '@/api/tenantClient';
import type {
  DashboardRange,
  InventoryAlertsData,
  InventoryStockAlert,
  KpiMetric,
  KpiStripData,
  PipelineMix,
  PipelineMixSegment,
  RecentRecord,
  RecentRecordsData,
  SalesOrderAtRisk,
  SalesOrderStatusBucket,
  SalesOrdersSnapshotData,
  TopCustomer,
  TopCustomersData,
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

interface SalesOrdersSnapshotWire {
  success: boolean;
  range: DashboardRange;
  openCount?: number;
  openValue?: number;
  lateCount?: number;
  lateValue?: number;
  statuses?: SalesOrderStatusBucket[];
  atRisk?: SalesOrderAtRisk[];
}

interface TopCustomersWire {
  success: boolean;
  range: DashboardRange;
  customers?: TopCustomer[];
  totalValue?: number;
  customerCount?: number;
}

interface InventoryAlertsWire {
  success: boolean;
  range: DashboardRange;
  alerts?: InventoryStockAlert[];
  alertCount?: number;
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

  getSalesOrdersSnapshot: (range: DashboardRange): Promise<SalesOrdersSnapshotData> =>
    tenantClient
      .get<SalesOrdersSnapshotWire>('/tenant/dashboard/widgets/sales-orders-snapshot/data', { params: { range } })
      .then((r) => ({
        range: r.data.range,
        openCount: r.data.openCount ?? 0,
        openValue: r.data.openValue ?? 0,
        lateCount: r.data.lateCount ?? 0,
        lateValue: r.data.lateValue ?? 0,
        statuses: r.data.statuses ?? [],
        atRisk: r.data.atRisk ?? [],
      })),

  getTopCustomers: (range: DashboardRange): Promise<TopCustomersData> =>
    tenantClient
      .get<TopCustomersWire>('/tenant/dashboard/widgets/top-customers/data', { params: { range } })
      .then((r) => ({
        range: r.data.range,
        customers: r.data.customers ?? [],
        totalValue: r.data.totalValue ?? 0,
        customerCount: r.data.customerCount ?? 0,
      })),

  getInventoryAlerts: (range: DashboardRange): Promise<InventoryAlertsData> =>
    tenantClient
      .get<InventoryAlertsWire>('/tenant/dashboard/widgets/inventory-alerts/data', { params: { range } })
      .then((r) => ({
        range: r.data.range,
        alerts: r.data.alerts ?? [],
        alertCount: r.data.alertCount ?? 0,
      })),
};
