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

// One tile's count + value pair in the Purchases & requisitions status
// widget (Incoming, Overdue, Pending).
export interface PurchasesTileValue {
  count: number;
  value: number;
}

export type PurchasesAttentionKind = 'purchase_order' | 'requisition';

// One row in the widget's combined attention worklist -- either a
// SENT/PART purchase order whose expected delivery has passed (daysOverdue
// set, daysWaiting null), or a purchase order/requisition stuck waiting for
// approval sign-off (daysWaiting set, daysOverdue null). See
// controllers/dashboard_purchases.go's attentionRow -- exactly one of the
// two day counts is ever set.
export interface PurchasesAttentionRow {
  kind: PurchasesAttentionKind;
  id: string;
  recordNumber: string;
  party: string;
  value: number;
  daysOverdue: number | null;
  daysWaiting: number | null;
}

// Purchases & requisitions status widget payload. pending is null when the
// caller is not a configured approver for purchase orders or requisitions
// at all -- "not applicable to you", distinct from a real 0 tile meaning
// "you're caught up" (see controllers/dashboard_purchases.go's
// buildPurchasesStatus). Ignores range like inventory-alerts -- every
// figure here is "right now" open work, not date-windowed.
export interface PurchasesStatusData {
  range: DashboardRange;
  incoming: PurchasesTileValue;
  overdue: PurchasesTileValue;
  pending: PurchasesTileValue | null;
  attention: PurchasesAttentionRow[];
  attentionCount: number;
}

// One row in the Material consumption widget's ranked list -- a slab-tracked
// inventory item, ranked by net area consumed within the console's selected
// range. netUsed is server-computed (consumed minus recovered remnants,
// clamped at zero -- see controllers/dashboard_material.go's netUsedArea) and
// is what the widget leads with; consumedArea/recoveredArea/scrappedArea are
// the raw components behind it, for the row's sub-label. colorHex is '' when
// the item has no color assigned (or the tenant hasn't set a swatch for its
// color yet) -- the widget falls back to a deterministic palette keyed on id
// rather than rendering an empty swatch. unitCode is the item's own unit
// (SQFT, EA, ...) -- never summed across rows, since items can carry
// different units.
export interface MaterialConsumptionRow {
  id: string;
  name: string;
  unitCode: string;
  colorHex: string;
  netUsed: number;
  consumedArea: number;
  recoveredArea: number;
  scrappedArea: number;
  slabCount: number;
}

export interface MaterialConsumptionData {
  range: DashboardRange;
  materials: MaterialConsumptionRow[];
  materialCount: number;
  slabTotal: number;
}

// One aging band in the Accounts receivable widget's bar chart. All four
// bands (0-30/31-60/61-90/90+) are always present and in this order, even
// when a band is empty -- see controllers/dashboard_ar.go's mapAgingBuckets.
export interface ArAgingBucket {
  label: '0-30' | '31-60' | '61-90' | '90+';
  amount: number;
  count: number;
}

// One row in the Accounts receivable widget's oldest-outstanding worklist,
// ranked most-overdue-first. daysPastDue is 0 for an invoice with no due
// date set -- not a real "not overdue yet" reading, just the absence of
// terms to be late against (see the backend's invoice.OutstandingAging doc
// comment).
export interface OutstandingInvoiceRow {
  id: string;
  invoiceNumber: string;
  customer: string;
  balanceDue: number;
  daysPastDue: number;
}

// Accounts receivable widget payload. Ignores range like inventory-alerts --
// an outstanding balance is current state, not a date window. overdueTotal/
// overdueCount cover only the subset of `outstanding` actually past its due
// date; oldestCount is every outstanding invoice, not just the ones listed
// in `oldest`, so the widget's "N more" hint stays accurate.
export interface ArOutstandingData {
  range: DashboardRange;
  outstanding: number;
  overdueTotal: number;
  overdueCount: number;
  buckets: ArAgingBucket[];
  oldest: OutstandingInvoiceRow[];
  oldestCount: number;
}

// One row in the Accounting snapshot widget's recent-entries list. date is a
// real ISO timestamp -- the widget formats it ("2h ago") itself via
// lib/recentRecordRoute's relativeTime, same as Recent records.
export interface JournalEntryRow {
  id: string;
  entryNumber: string;
  description: string;
  amount: number;
  date: string;
}

// The Accounting snapshot widget's period pill. Mirrors PeriodStatus in
// types/accountingPeriod.ts but is intentionally its own type -- this is a
// read-only summary for the dashboard card, not the full Period record.
export interface AccountingPeriodSummary {
  name: string;
  status: 'open' | 'closed';
  entryCount: number;
}

// Accounting snapshot widget payload. period is null when the tenant has
// never configured an accounting calendar (Config > Accounting Periods) --
// the widget renders a setup empty state rather than inventing a month.
// entryTotal falls back to entries.length in that case, so the widget's "N
// entries" line still says something true even with no period to count over.
export interface AccountingSnapshotData {
  range: DashboardRange;
  period: AccountingPeriodSummary | null;
  entries: JournalEntryRow[];
  entryTotal: number;
}
