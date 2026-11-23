// Display rules for stock figures, shared by the Stock on Hand list and an item's per-location rows.

const QTY_DECIMALS = 3;

/** A quantity to at most three decimals with no trailing zeros ("3.5", "1,234.568"). */
export function formatStockQty(value: number): string {
  if (!Number.isFinite(value)) return '0';
  return Number(value.toFixed(QTY_DECIMALS)).toLocaleString('en-US', { maximumFractionDigits: QTY_DECIMALS });
}

/** At or below a reorder point. A reorder point of 0 means none is set, so
 *  nothing is ever low against it — the dashboard's alert uses the same rule. */
export function isLowStock(onHand: number, reorderPoint: number): boolean {
  return reorderPoint > 0 && onHand <= reorderPoint;
}
