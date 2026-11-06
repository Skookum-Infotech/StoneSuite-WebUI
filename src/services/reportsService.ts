import { tenantClient } from '@/api/tenantClient';
import type {
  ApAgingReport,
  ApAgingRow,
  ApAgingTotals,
  OpenPoRow,
  OpenPoTotals,
  PurchaseItemRow,
  PurchaseItemTotals,
  PurchaseVendorRow,
  PurchaseVendorTotals,
  PurchasesReport,
  PurchasesReportParams,
  CrmFunnel,
  CrmFunnelStage,
  CrmReportParams,
  CrmSourceReport,
  CrmSourceRow,
  CrmSourceTotals,
  CrmStaleRecord,
  CrmStaleReport,
  SalesBasis,
  SalesCustomerRow,
  SalesDrillRecord,
  SalesDrillResult,
  SalesDrillSelector,
  SalesItemRow,
  SalesReport,
  SalesReportParams,
  SalesTotals,
  SalesTrendRow,
} from '@/types/reports';

interface SalesReportWire<Row> {
  success: boolean;
  basis: SalesBasis;
  totals: SalesTotals;
  rows?: Row[];
}

interface SalesDrillWire {
  success: boolean;
  basis: SalesBasis;
  path: string;
  records?: SalesDrillRecord[];
}

function toReport<Row>(wire: SalesReportWire<Row>): SalesReport<Row> {
  return { basis: wire.basis, totals: wire.totals, rows: wire.rows ?? [] };
}

interface CrmFunnelWire {
  success: boolean;
  stages?: CrmFunnelStage[];
  unqualified: number;
}

interface CrmSourceWire {
  success: boolean;
  totals: CrmSourceTotals;
  rows?: CrmSourceRow[];
}

interface CrmStaleWire {
  success: boolean;
  days: number;
  rows?: CrmStaleRecord[];
}

interface PurchasesWire<Row, Totals> {
  success: boolean;
  totals: Totals;
  rows?: Row[];
  labels?: string[];
}

function toPurchases<Row, Totals>(w: PurchasesWire<Row, Totals>): PurchasesReport<Row, Totals> {
  return { totals: w.totals, rows: w.rows ?? [] };
}

// Window + basis (+ bucket) go as query params. The server resolves tenant,
// user and data scope from the JWT — never pass them from here.
export const reportsService = {
  salesByCustomer: (params: SalesReportParams): Promise<SalesReport<SalesCustomerRow>> =>
    tenantClient
      .get<SalesReportWire<SalesCustomerRow>>('/tenant/reports/sales/by-customer', { params })
      .then((r) => toReport(r.data)),

  salesByItem: (params: SalesReportParams): Promise<SalesReport<SalesItemRow>> =>
    tenantClient
      .get<SalesReportWire<SalesItemRow>>('/tenant/reports/sales/by-item', { params })
      .then((r) => toReport(r.data)),

  salesTrend: (params: SalesReportParams): Promise<SalesReport<SalesTrendRow>> =>
    tenantClient
      .get<SalesReportWire<SalesTrendRow>>('/tenant/reports/sales/trend', { params })
      .then((r) => toReport(r.data)),

  salesRecords: (params: SalesReportParams, selector: SalesDrillSelector): Promise<SalesDrillResult> =>
    tenantClient
      .get<SalesDrillWire>('/tenant/reports/sales/records', { params: { ...params, ...selector } })
      .then((r) => ({ basis: r.data.basis, path: r.data.path, records: r.data.records ?? [] })),

  crmFunnel: (params: CrmReportParams): Promise<CrmFunnel> =>
    tenantClient
      .get<CrmFunnelWire>('/tenant/reports/crm/funnel', { params })
      .then((r) => ({ stages: r.data.stages ?? [], unqualified: r.data.unqualified })),

  crmLeadSources: (params: CrmReportParams): Promise<CrmSourceReport> =>
    tenantClient
      .get<CrmSourceWire>('/tenant/reports/crm/lead-sources', { params })
      .then((r) => ({ totals: r.data.totals, rows: r.data.rows ?? [] })),

  crmStale: (days: number): Promise<CrmStaleReport> =>
    tenantClient
      .get<CrmStaleWire>('/tenant/reports/crm/stale', { params: { days } })
      .then((r) => ({ days: r.data.days, rows: r.data.rows ?? [] })),

  purchasesByVendor: (params: PurchasesReportParams): Promise<PurchasesReport<PurchaseVendorRow, PurchaseVendorTotals>> =>
    tenantClient
      .get<PurchasesWire<PurchaseVendorRow, PurchaseVendorTotals>>('/tenant/reports/purchases/by-vendor', { params })
      .then((r) => toPurchases(r.data)),

  purchasesByItem: (params: PurchasesReportParams): Promise<PurchasesReport<PurchaseItemRow, PurchaseItemTotals>> =>
    tenantClient
      .get<PurchasesWire<PurchaseItemRow, PurchaseItemTotals>>('/tenant/reports/purchases/by-item', { params })
      .then((r) => toPurchases(r.data)),

  openPurchaseOrders: (): Promise<PurchasesReport<OpenPoRow, OpenPoTotals>> =>
    tenantClient
      .get<PurchasesWire<OpenPoRow, OpenPoTotals>>('/tenant/reports/purchases/open-pos')
      .then((r) => toPurchases(r.data)),

  apAging: (): Promise<ApAgingReport> =>
    tenantClient
      .get<PurchasesWire<ApAgingRow, ApAgingTotals>>('/tenant/reports/purchases/ap-aging')
      .then((r) => ({ ...toPurchases(r.data), labels: r.data.labels ?? [] })),
};
