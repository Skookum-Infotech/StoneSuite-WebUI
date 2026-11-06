import { formatMoney } from '@/lib/formatMoney';
import type { ReportTable } from '@/lib/reportExport';
import { formatPercent, formatQuantity, formatReportDate } from '@/lib/reportFormat';
import type {
  ApAgingReport,
  OpenPoRow,
  OpenPoTotals,
  PurchaseItemRow,
  PurchaseItemTotals,
  PurchaseVendorRow,
  PurchaseVendorTotals,
  PurchasesReport,
  PurchasesReportParams,
} from '@/types/reports';

const NO_VALUE = '—';
const TOTALS_LABEL = 'Total';
const AMOUNTS_NOTE = 'net of tax and shipping';
const SIGN_PLUS = '+';
const ON_TIME = 'On time';
const NO_EXPECTED_DATE = 'No expected date';

/** "Jan 1, 2026 to Nov 6, 2026 · net of tax and shipping". */
export function describePurchasesWindow(params: PurchasesReportParams): string {
  return `${formatReportDate(params.from)} to ${formatReportDate(params.to)} · ${AMOUNTS_NOTE}`;
}

/** "+12.5%" / "-3.0%", or a dash when there was no starting cost. */
export function formatCostChange(change: number | null): string {
  if (change === null) return NO_VALUE;
  return `${change > 0 ? SIGN_PLUS : ''}${formatPercent(change)}`;
}

/** Expected date, or a dash for an order with none. */
export function formatExpected(iso: string | null): string {
  return iso ? formatReportDate(iso) : NO_VALUE;
}

/** What an open order's timing means: late by N days, on time, or unknown
 *  because it has no expected date. */
export function formatTiming(expectedDate: string | null, daysOverdue: number): string {
  if (!expectedDate) return NO_EXPECTED_DATE;
  if (daysOverdue <= 0) return ON_TIME;
  return daysOverdue === 1 ? "1 day late" : `${daysOverdue} days late`;
}

export function vendorReportTable(
  report: PurchasesReport<PurchaseVendorRow, PurchaseVendorTotals>,
  params: PurchasesReportParams,
): ReportTable {
  const t = report.totals;
  return {
    title: 'Purchases by Vendor',
    subtitle: `Orders and bills dated ${describePurchasesWindow(params)}`,
    headers: ['Vendor', 'POs', 'PO value', 'Avg PO value', 'Open PO value', 'Bills', 'Billed', 'Balance owed'],
    rows: report.rows.map((r) => [
      r.name,
      String(r.poCount),
      formatMoney(r.poValue),
      formatMoney(r.avgPoValue),
      formatMoney(r.openPoValue),
      String(r.billCount),
      formatMoney(r.billed),
      formatMoney(r.balanceOwed),
    ]),
    totalsRow: [TOTALS_LABEL, String(t.poCount), formatMoney(t.poValue), '', formatMoney(t.openPoValue), String(t.billCount), formatMoney(t.billed), formatMoney(t.balanceOwed)],
  };
}

export function purchaseItemReportTable(
  report: PurchasesReport<PurchaseItemRow, PurchaseItemTotals>,
  params: PurchasesReportParams,
): ReportTable {
  return {
    title: 'Purchases by Item',
    subtitle: `Purchase orders dated ${describePurchasesWindow(params)}`,
    headers: ['SKU', 'Item', 'Qty ordered', 'Qty received', 'Spend', 'Avg cost', 'Lowest cost', 'Highest cost', 'Cost change'],
    rows: report.rows.map((r) => [
      r.sku,
      r.name,
      `${formatQuantity(r.quantity)} ${r.unit}`.trim(),
      formatQuantity(r.received),
      formatMoney(r.spend),
      formatMoney(r.avgCost),
      formatMoney(r.minCost),
      formatMoney(r.maxCost),
      formatCostChange(r.costChangePercent),
    ]),
    totalsRow: [TOTALS_LABEL, '', '', '', formatMoney(report.totals.spend), '', '', '', ''],
  };
}

export function openPoReportTable(report: PurchasesReport<OpenPoRow, OpenPoTotals>): ReportTable {
  const t = report.totals;
  return {
    title: 'Open POs and Receiving',
    subtitle: `Purchase orders sent to the vendor and not fully received, as of today · ${AMOUNTS_NOTE}`,
    headers: ['PO', 'Vendor', 'Status', 'Order date', 'Expected', 'Value', 'Received', 'Outstanding', 'Timing'],
    rows: report.rows.map((r) => [
      r.number,
      r.vendor,
      r.status,
      formatReportDate(r.orderDate),
      formatExpected(r.expectedDate),
      formatMoney(r.value),
      formatPercent(r.receivedPercent),
      formatMoney(r.outstanding),
      formatTiming(r.expectedDate, r.daysOverdue),
    ]),
    totalsRow: [TOTALS_LABEL, String(t.count), '', '', '', '', '', formatMoney(t.outstanding), `${t.overdueCount} late`],
  };
}

export function apAgingReportTable(report: ApAgingReport): ReportTable {
  return {
    title: 'AP Aging',
    subtitle: 'Unpaid vendor bills by days past due, as of today',
    headers: ['Vendor', 'Bills', ...report.labels, 'Total owed'],
    rows: report.rows.map((r) => [r.name, String(r.bills), ...r.buckets.map((b) => formatMoney(b)), formatMoney(r.total)]),
    totalsRow: [TOTALS_LABEL, String(report.totals.bills), ...report.totals.buckets.map((b) => formatMoney(b)), formatMoney(report.totals.total)],
  };
}
