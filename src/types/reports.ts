/** Which document a Sales report counts: booked orders or billed invoices. */
export type SalesBasis = 'orders' | 'invoices';

export type TrendBucket = 'week' | 'month';

/** The window + options every Sales report sends to the server. */
export interface SalesReportParams {
  basis: SalesBasis;
  /** ISO `yyyy-mm-dd`, inclusive. */
  from: string;
  /** ISO `yyyy-mm-dd`, inclusive. */
  to: string;
  bucket?: TrendBucket;
}

/** The KPI strip every Sales report shows. */
export interface SalesTotals {
  revenue: number;
  cost: number;
  margin: number;
  marginPercent: number;
  records: number;
}

export interface SalesCustomerRow {
  customerId: string;
  name: string;
  records: number;
  revenue: number;
  cost: number;
  margin: number;
  avgValue: number;
  lastDate: string | null;
}

export interface SalesItemRow {
  itemId: string;
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  records: number;
  revenue: number;
  cost: number;
  margin: number;
  avgPrice: number;
}

export interface SalesTrendRow {
  /** ISO `yyyy-mm-dd`, first day of the week/month. */
  period: string;
  records: number;
  revenue: number;
  cost: number;
  margin: number;
}

export interface SalesReport<Row> {
  basis: SalesBasis;
  totals: SalesTotals;
  rows: Row[];
}

/** One report row to open in the drill-down panel; exactly one field is set. */
export interface SalesDrillSelector {
  customerId?: string;
  itemId?: string;
  period?: string;
}

export interface SalesDrillRecord {
  id: string;
  number: string;
  date: string;
  customer: string;
  status: string;
  revenue: number;
}

export interface SalesDrillResult {
  basis: SalesBasis;
  /** Frontend list route of the basis, e.g. `/sales/invoices`; a record opens at `${path}/${id}`. */
  path: string;
  records: SalesDrillRecord[];
}

/** A report listed on a module's hub page. */
export interface ReportCardInfo {
  id: string;
  title: string;
  description: string;
  /** Route of the report page; omitted while the report is still planned. */
  path?: string;
}

export interface ReportModuleInfo {
  slug: string;
  label: string;
  description: string;
  /** `report_<module>` permission resource that gates the module. */
  resource: string;
  reports: ReportCardInfo[];
}

/** The lead-creation window CRM cohort reports send. */
export interface CrmReportParams {
  /** ISO `yyyy-mm-dd`, inclusive. */
  from: string;
  /** ISO `yyyy-mm-dd`, inclusive. */
  to: string;
}

export interface CrmFunnelStage {
  key: string;
  label: string;
  count: number;
  percentOfLeads: number;
  percentOfPrevious: number;
  /** Average days from lead creation to this stage; null where not measured. */
  avgDaysFromLead: number | null;
}

export interface CrmFunnel {
  stages: CrmFunnelStage[];
  unqualified: number;
}

export interface CrmSourceRow {
  source: string;
  leads: number;
  qualified: number;
  prospects: number;
  customers: number;
  conversionPercent: number;
  revenue: number;
  revenuePerLead: number;
}

export interface CrmSourceTotals {
  leads: number;
  customers: number;
  conversionPercent: number;
  revenue: number;
}

export interface CrmSourceReport {
  totals: CrmSourceTotals;
  rows: CrmSourceRow[];
}

export interface CrmStaleRecord {
  id: string;
  stage: 'lead' | 'prospect';
  name: string;
  status: string;
  owner: string;
  lastTouch: string;
  daysIdle: number;
}

export interface CrmStaleReport {
  days: number;
  rows: CrmStaleRecord[];
}

/** The date window the windowed Purchases reports send. */
export interface PurchasesReportParams {
  /** ISO `yyyy-mm-dd`, inclusive. */
  from: string;
  /** ISO `yyyy-mm-dd`, inclusive. */
  to: string;
}

export interface PurchaseVendorRow {
  vendorId: string;
  name: string;
  poCount: number;
  poValue: number;
  avgPoValue: number;
  openPoValue: number;
  billCount: number;
  billed: number;
  balanceOwed: number;
}

export interface PurchaseVendorTotals {
  poCount: number;
  poValue: number;
  openPoValue: number;
  billCount: number;
  billed: number;
  balanceOwed: number;
}

export interface PurchaseItemRow {
  itemId: string;
  sku: string;
  name: string;
  quantity: number;
  unit: string;
  received: number;
  poCount: number;
  spend: number;
  avgCost: number;
  minCost: number;
  maxCost: number;
  firstCost: number;
  lastCost: number;
  /** Move from the first to the last unit cost in the window; null with no starting cost. */
  costChangePercent: number | null;
}

export interface PurchaseItemTotals {
  spend: number;
  items: number;
  poCount: number;
}

export interface OpenPoRow {
  id: string;
  number: string;
  vendor: string;
  status: string;
  orderDate: string;
  expectedDate: string | null;
  value: number;
  outstanding: number;
  receivedPercent: number;
  daysOverdue: number;
}

export interface OpenPoTotals {
  count: number;
  outstanding: number;
  overdueCount: number;
  overdueValue: number;
}

export interface ApAgingRow {
  vendorId: string;
  name: string;
  bills: number;
  /** One amount per label, in label order. */
  buckets: number[];
  total: number;
}

export interface ApAgingTotals {
  bills: number;
  buckets: number[];
  total: number;
}

export interface PurchasesReport<Row, Totals> {
  totals: Totals;
  rows: Row[];
}

export interface ApAgingReport extends PurchasesReport<ApAgingRow, ApAgingTotals> {
  labels: string[];
}

/** The date window the Stock Movement report sends. */
export interface InventoryMovementParams {
  /** ISO `yyyy-mm-dd`, inclusive. */
  from: string;
  /** ISO `yyyy-mm-dd`, inclusive. */
  to: string;
}

export interface StockRow {
  itemId: string;
  sku: string;
  name: string;
  tracking: string;
  unit: string;
  location: string;
  onHand: number;
  allocated: number;
  available: number;
  unitCost: number;
  value: number;
}

export interface StockTotals {
  value: number;
  items: number;
  locations: number;
  rows: number;
}

export interface SlabRow {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  /** Slab counts, one per label, in label order. */
  counts: number[];
  /** Slab area in the item's unit, one per label. */
  areas: number[];
  totalSlabs: number;
  totalArea: number;
}

export interface SlabTotals {
  counts: number[];
  areas: number[];
  totalSlabs: number;
}

export interface SlabReport {
  labels: string[];
  totals: SlabTotals;
  rows: SlabRow[];
}

export type LowStockState = 'out' | 'below';

export interface LowStockRow {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  location: string;
  onHand: number;
  allocated: number;
  available: number;
  reorderPoint: number;
  onOrder: number;
  suggestedOrder: number;
  state: LowStockState;
}

export interface LowStockTotals {
  rows: number;
  outOfStock: number;
  items: number;
}

export interface MovementRow {
  itemId: string;
  sku: string;
  name: string;
  unit: string;
  received: number;
  returned: number;
  consumed: number;
  scrapped: number;
  adjusted: number;
  net: number;
  movements: number;
}

export interface MovementTotals {
  items: number;
  movements: number;
  growing: number;
  shrinking: number;
}

export interface InventoryReport<Row, Totals> {
  totals: Totals;
  rows: Row[];
}
