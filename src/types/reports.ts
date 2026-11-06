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
