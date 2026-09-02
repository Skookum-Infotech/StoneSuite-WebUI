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
