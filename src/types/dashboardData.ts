// Real-data payloads for dashboard widgets (as opposed to
// src/types/dashboardWidgets.ts, which covers widget allocation/preference —
// which widgets a role/user may see, not what they render).

// The dashboard-wide time window, controlled by ConsoleHeader and threaded
// into every range-aware widget query. 'all' is the default: the current
// shape of the data, not a recent-activity window (see DashboardPage).
export type DashboardRange = 'all' | '7d' | '30d' | 'quarter';

export interface PipelineMixSegment {
  id: 'lead' | 'prospect' | 'customer';
  count: number;
}

export interface PipelineMix {
  range: DashboardRange;
  segments: PipelineMixSegment[];
  closeRate: number;
}

// One KPI strip tile. deltaPct (Revenue) and deltaCount (Open Leads) are
// mutually exclusive with each other and with subLabel (Sales Orders,
// Needs Approval) -- a metric has a %/count trend or a sub-metric label,
// never both. sparkline is present only for the two trend-bearing metrics.
export interface KpiMetric {
  id: 'revenue' | 'open-leads' | 'sales-orders-fabrication' | 'needs-approval';
  value: number;
  deltaPct?: number;
  deltaCount?: number;
  sparkline?: number[];
  subLabel?: string;
  oldestDays?: number;
}

export interface KpiStripData {
  range: DashboardRange;
  metrics: KpiMetric[];
}

// One row in the Recent records widget, merged server-side across every
// CRM/Sales/Purchases module the caller can read (see
// controllers/dashboard_recent.go). module/domain are backend keys, not
// display labels -- see lib/recentRecordRoute.ts (route building) and
// RecentRecordsTable.tsx (badge label/color lookup).
export interface RecentRecord {
  id: string;
  module: string;
  domain: 'crm' | 'sales' | 'purchases';
  recordNumber: string;
  account: string | null;
  value: number | null;
  status: string;
  updatedAt: string;
}

export interface RecentRecordsData {
  range: DashboardRange;
  records: RecentRecord[];
  hasMore: boolean;
}

// One live (non-terminal) status's aggregate in the Sales orders snapshot
// widget's status breakdown -- see controllers/dashboard_salesorders.go.
export interface SalesOrderStatusBucket {
  code: string;
  label: string;
  count: number;
  value: number;
}

// One row in the Sales orders snapshot widget's at-risk worklist -- an open
// (approved-or-further) order ranked most-overdue-or-soonest-due first.
// daysLate is positive when overdue, negative when due in the future, and
// null when the order has no expected delivery date set.
export interface SalesOrderAtRisk {
  id: string;
  recordNumber: string;
  customer: string;
  value: number;
  status: string;
  daysLate: number | null;
}

export interface SalesOrdersSnapshotData {
  range: DashboardRange;
  openCount: number;
  openValue: number;
  lateCount: number;
  lateValue: number;
  statuses: SalesOrderStatusBucket[];
  atRisk: SalesOrderAtRisk[];
}

// One row in the Top customers widget's leaderboard, ranked by billed
// invoice revenue. id is null when the caller holds no customer:read grant
// (render the name unlinked, not a route into a permission wall).
// priorValue is null when the selected range has no applicable prior period
// ("all" time); otherwise a real number (including 0, meaning the customer
// billed nothing in the prior window -- a "new this period" signal, not
// missing data) for the immediately preceding equal-length window.
export interface TopCustomer {
  id: string | null;
  name: string;
  value: number;
  priorValue: number | null;
}

export interface TopCustomersData {
  range: DashboardRange;
  customers: TopCustomer[];
  totalValue: number;
  customerCount: number;
}

// One row in the Inventory alerts widget's list -- an (item, warehouse)
// stock level with a problem, ranked most-severe-tier first by the backend.
// severity is server-computed (see controllers/dashboard_inventory.go's
// classifyStockAlert) rather than re-derived client-side, so a row's badge
// can never disagree with the rank that put it in this list:
//   'short' -- allocated to open sales orders exceeds on-hand stock (a
//              commitment that can't currently be fulfilled)
//   'out'   -- nothing on hand at all
//   'low'   -- on-hand at or under a configured reorder point
export type StockAlertSeverity = 'short' | 'out' | 'low';

export interface InventoryStockAlert {
  id: string;
  itemName: string;
  warehouse: string;
  onHand: number;
  allocated: number;
  reorderPoint: number;
  severity: StockAlertSeverity;
}

// Stock levels are current-state, not date-windowed -- range is carried
// here for contract uniformity with the other widgets, but changing it has
// no effect on this widget's data (see the backend handler's doc comment).
export interface InventoryAlertsData {
  range: DashboardRange;
  alerts: InventoryStockAlert[];
  alertCount: number;
}
