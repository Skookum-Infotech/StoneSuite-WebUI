// Real-data payloads for dashboard widgets — one method per widget (see
// controllers/dashboard_pipeline.go on the backend), as opposed to
// dashboardWidgetService.ts, which covers widget allocation/preference.
import { tenantClient } from '@/api/tenantClient';
import type {
  AccountingPeriodSummary,
  AccountingSnapshotData,
  ArAgingBucket,
  ArOutstandingData,
  DashboardRange,
  InventoryAlertsData,
  InventoryStockAlert,
  JournalEntryRow,
  KpiMetric,
  KpiStripData,
  MaterialConsumptionData,
  MaterialConsumptionRow,
  OutstandingInvoiceRow,
  PipelineMix,
  PipelineMixSegment,
  PurchasesAttentionRow,
  PurchasesStatusData,
  PurchasesTileValue,
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

interface PurchasesStatusWire {
  success: boolean;
  range: DashboardRange;
  incoming?: PurchasesTileValue;
  overdue?: PurchasesTileValue;
  pending?: PurchasesTileValue | null;
  attention?: PurchasesAttentionRow[];
  attentionCount?: number;
}

interface MaterialConsumptionWire {
  success: boolean;
  range: DashboardRange;
  materials?: MaterialConsumptionRow[];
  materialCount?: number;
  slabTotal?: number;
}

interface ArOutstandingWire {
  success: boolean;
  range: DashboardRange;
  outstanding?: number;
  overdueTotal?: number;
  overdueCount?: number;
  buckets?: ArAgingBucket[];
  oldest?: OutstandingInvoiceRow[];
  oldestCount?: number;
}

interface AccountingSnapshotWire {
  success: boolean;
  range: DashboardRange;
  period?: AccountingPeriodSummary | null;
  entries?: JournalEntryRow[];
  entryTotal?: number;
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

  getPurchasesStatus: (range: DashboardRange): Promise<PurchasesStatusData> =>
    tenantClient
      .get<PurchasesStatusWire>('/tenant/dashboard/widgets/purchases-status/data', { params: { range } })
      .then((r) => ({
        range: r.data.range,
        incoming: r.data.incoming ?? { count: 0, value: 0 },
        overdue: r.data.overdue ?? { count: 0, value: 0 },
        pending: r.data.pending ?? null,
        attention: r.data.attention ?? [],
        attentionCount: r.data.attentionCount ?? 0,
      })),

  getMaterialConsumption: (range: DashboardRange): Promise<MaterialConsumptionData> =>
    tenantClient
      .get<MaterialConsumptionWire>('/tenant/dashboard/widgets/material-consumption/data', { params: { range } })
      .then((r) => ({
        range: r.data.range,
        materials: r.data.materials ?? [],
        materialCount: r.data.materialCount ?? 0,
        slabTotal: r.data.slabTotal ?? 0,
      })),

  getArOutstanding: (range: DashboardRange): Promise<ArOutstandingData> =>
    tenantClient
      .get<ArOutstandingWire>('/tenant/dashboard/widgets/ar-outstanding/data', { params: { range } })
      .then((r) => ({
        range: r.data.range,
        outstanding: r.data.outstanding ?? 0,
        overdueTotal: r.data.overdueTotal ?? 0,
        overdueCount: r.data.overdueCount ?? 0,
        buckets: r.data.buckets ?? [],
        oldest: r.data.oldest ?? [],
        oldestCount: r.data.oldestCount ?? 0,
      })),

  getAccountingSnapshot: (range: DashboardRange): Promise<AccountingSnapshotData> =>
    tenantClient
      .get<AccountingSnapshotWire>('/tenant/dashboard/widgets/accounting-snapshot/data', { params: { range } })
      .then((r) => ({
        range: r.data.range,
        period: r.data.period ?? null,
        entries: r.data.entries ?? [],
        entryTotal: r.data.entryTotal ?? 0,
      })),
};
