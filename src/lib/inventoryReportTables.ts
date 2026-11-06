import { formatMoney } from '@/lib/formatMoney';
import type { ReportTable } from '@/lib/reportExport';
import { formatQuantity, formatReportDate } from '@/lib/reportFormat';
import type {
  InventoryMovementParams,
  InventoryReport,
  LowStockRow,
  LowStockState,
  LowStockTotals,
  MovementRow,
  MovementTotals,
  SlabReport,
  StockRow,
  StockTotals,
} from '@/types/reports';

const TOTALS_LABEL = 'Total';
const NO_VALUE = '—';

export const LOW_STOCK_STATE_LABELS: Record<LowStockState, string> = {
  out: 'Out of stock',
  below: 'Below reorder point',
};

/** "12.5 SQFT" — a quantity with its unit, no trailing space for unit-less items. */
export function formatQty(quantity: number, unit: string): string {
  return `${formatQuantity(quantity)} ${unit}`.trim();
}

/** "+5.5 SQFT" / "-3 SQFT" — a signed movement quantity; zero shows as a dash. */
export function formatSignedQty(quantity: number, unit: string): string {
  if (quantity === 0) return NO_VALUE;
  return `${quantity > 0 ? '+' : ''}${formatQty(quantity, unit)}`;
}

/** "10 slabs · 259.45 SQFT", or a dash when none. */
export function formatSlabCell(count: number, area: number, unit: string): string {
  if (count === 0) return NO_VALUE;
  return `${count} ${count === 1 ? 'slab' : 'slabs'} · ${formatQty(area, unit)}`;
}

export interface ItemValue {
  name: string;
  value: number;
}

/** Collapses item-at-location rows to one entry per item (summing value) for
 *  the "value by item" chart, largest first. */
export function valueByItem(rows: StockRow[]): ItemValue[] {
  const byItem = new Map<string, ItemValue>();
  for (const r of rows) {
    const existing = byItem.get(r.itemId);
    if (existing) existing.value += r.value;
    else byItem.set(r.itemId, { name: r.name, value: r.value });
  }
  return [...byItem.values()].sort((a, b) => b.value - a.value);
}

export function stockReportTable(report: InventoryReport<StockRow, StockTotals>): ReportTable {
  return {
    title: 'Stock on Hand and Valuation',
    subtitle: 'Quantity on hand per item and location as of today · valued at each item’s current purchasing price',
    headers: ['SKU', 'Item', 'Location', 'On hand', 'Allocated', 'Available', 'Unit cost', 'Value'],
    rows: report.rows.map((r) => [
      r.sku,
      r.name,
      r.location,
      formatQty(r.onHand, r.unit),
      formatQty(r.allocated, r.unit),
      formatQty(r.available, r.unit),
      formatMoney(r.unitCost),
      formatMoney(r.value),
    ]),
    totalsRow: [TOTALS_LABEL, '', '', '', '', '', '', formatMoney(report.totals.value)],
  };
}

export function slabReportTable(report: SlabReport): ReportTable {
  return {
    title: 'Slab Availability',
    subtitle: 'Live slabs by material and status as of today · consumed and scrapped slabs are not counted',
    headers: ['SKU', 'Material', ...report.labels, 'Total'],
    rows: report.rows.map((r) => [
      r.sku,
      r.name,
      ...r.counts.map((c, i) => formatSlabCell(c, r.areas[i] ?? 0, r.unit)),
      formatSlabCell(r.totalSlabs, r.totalArea, r.unit),
    ]),
    totalsRow: [TOTALS_LABEL, '', ...report.totals.counts.map((c) => String(c)), String(report.totals.totalSlabs)],
  };
}

export function lowStockReportTable(report: InventoryReport<LowStockRow, LowStockTotals>): ReportTable {
  return {
    title: 'Low Stock',
    subtitle: 'Items at or below their reorder point as of today · only items with a reorder point set are checked',
    headers: ['SKU', 'Item', 'Location', 'Status', 'On hand', 'Available', 'Reorder point', 'On order', 'Suggested order'],
    rows: report.rows.map((r) => [
      r.sku,
      r.name,
      r.location,
      LOW_STOCK_STATE_LABELS[r.state],
      formatQty(r.onHand, r.unit),
      formatQty(r.available, r.unit),
      formatQty(r.reorderPoint, r.unit),
      formatQty(r.onOrder, r.unit),
      formatQty(r.suggestedOrder, r.unit),
    ]),
  };
}

export function movementReportTable(
  report: InventoryReport<MovementRow, MovementTotals>,
  params: InventoryMovementParams,
): ReportTable {
  return {
    title: 'Stock Movement',
    subtitle: `Movements ${formatReportDate(params.from)} to ${formatReportDate(params.to)} · adjusted includes counts and transfers`,
    headers: ['SKU', 'Item', 'Received', 'Returned', 'Consumed', 'Scrapped', 'Adjusted', 'Net change', 'Movements'],
    rows: report.rows.map((r) => [
      r.sku,
      r.name,
      formatSignedQty(r.received, r.unit),
      formatSignedQty(r.returned, r.unit),
      formatSignedQty(r.consumed, r.unit),
      formatSignedQty(r.scrapped, r.unit),
      formatSignedQty(r.adjusted, r.unit),
      formatSignedQty(r.net, r.unit),
      String(r.movements),
    ]),
  };
}
