import { formatMoney } from '@/lib/formatMoney';
import { formatPercent, formatPeriodLabel, formatQuantity, formatReportDate } from '@/lib/reportFormat';
import type { ReportTable } from '@/lib/reportExport';
import type {
  SalesBasis,
  SalesCustomerRow,
  SalesItemRow,
  SalesReport,
  SalesReportParams,
  SalesTotals,
  SalesTrendRow,
  TrendBucket,
} from '@/types/reports';

export const BASIS_LABELS: Record<SalesBasis, string> = {
  orders: 'Sales orders',
  invoices: 'Invoices',
};

export const TOTALS_LABEL = 'Total';

/** "Invoices · Jan 1, 2026 to Nov 6, 2026" — what a printed report says it covers. */
export function describeSalesWindow(params: SalesReportParams): string {
  return `${BASIS_LABELS[params.basis]} · ${formatReportDate(params.from)} to ${formatReportDate(params.to)} · net of tax and shipping`;
}

function marginPercent(revenue: number, margin: number): string {
  return revenue > 0 ? formatPercent((margin / revenue) * 100) : '—';
}

export function customerReportTable(report: SalesReport<SalesCustomerRow>, params: SalesReportParams): ReportTable {
  const t: SalesTotals = report.totals;
  return {
    title: 'Sales by Customer',
    subtitle: describeSalesWindow(params),
    headers: ['Customer', BASIS_LABELS[params.basis], 'Revenue', 'Cost', 'Margin', 'Margin %', 'Avg value', 'Last date'],
    rows: report.rows.map((r) => [
      r.name,
      String(r.records),
      formatMoney(r.revenue),
      formatMoney(r.cost),
      formatMoney(r.margin),
      marginPercent(r.revenue, r.margin),
      formatMoney(r.avgValue),
      formatReportDate(r.lastDate),
    ]),
    totalsRow: [TOTALS_LABEL, String(t.records), formatMoney(t.revenue), formatMoney(t.cost), formatMoney(t.margin), formatPercent(t.marginPercent), '', ''],
  };
}

export function itemReportTable(report: SalesReport<SalesItemRow>, params: SalesReportParams): ReportTable {
  const t = report.totals;
  return {
    title: 'Sales by Item',
    subtitle: describeSalesWindow(params),
    headers: ['SKU', 'Item', 'Quantity', 'Unit', 'Revenue', 'Avg price', 'Cost', 'Margin', 'Margin %'],
    rows: report.rows.map((r) => [
      r.sku,
      r.name,
      formatQuantity(r.quantity),
      r.unit,
      formatMoney(r.revenue),
      formatMoney(r.avgPrice),
      formatMoney(r.cost),
      formatMoney(r.margin),
      marginPercent(r.revenue, r.margin),
    ]),
    totalsRow: [TOTALS_LABEL, '', '', '', formatMoney(t.revenue), '', formatMoney(t.cost), formatMoney(t.margin), formatPercent(t.marginPercent)],
  };
}

export function trendReportTable(
  report: SalesReport<SalesTrendRow>,
  params: SalesReportParams,
  bucket: TrendBucket,
): ReportTable {
  const t = report.totals;
  return {
    title: 'Sales Trend',
    subtitle: describeSalesWindow(params),
    headers: [bucket === 'week' ? 'Week' : 'Month', BASIS_LABELS[params.basis], 'Revenue', 'Cost', 'Margin', 'Margin %'],
    rows: report.rows.map((r) => [
      formatPeriodLabel(r.period, bucket),
      String(r.records),
      formatMoney(r.revenue),
      formatMoney(r.cost),
      formatMoney(r.margin),
      marginPercent(r.revenue, r.margin),
    ]),
    totalsRow: [TOTALS_LABEL, String(t.records), formatMoney(t.revenue), formatMoney(t.cost), formatMoney(t.margin), formatPercent(t.marginPercent)],
  };
}
