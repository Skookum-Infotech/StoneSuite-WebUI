import { tenantClient } from '@/api/tenantClient';
import type {
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
};
