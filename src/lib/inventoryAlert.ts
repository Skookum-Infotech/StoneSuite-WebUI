import type { InventoryStockAlert } from '@/types/dashboardData';

/**
 * Builds the Inventory alerts widget's secondary detail line, varying by
 * severity so each row explains the specific number that matters for its
 * problem rather than repeating the on-hand figure already shown above it:
 * how much is committed against a short row, nothing extra for an out row
 * (there's nothing more to say -- it's simply empty), and the configured
 * threshold for a low row.
 */
export function formatAlertDetail(alert: InventoryStockAlert): string {
  switch (alert.severity) {
    case 'short':
      return `${alert.warehouse} · ${formatStockQty(alert.allocated)} committed`;
    case 'low':
      return `${alert.warehouse} · reorder at ${formatStockQty(alert.reorderPoint)}`;
    default: // 'out'
      return alert.warehouse;
  }
}

/**
 * Formats a stock quantity (backend DECIMAL(14,3) -- may carry fractional
 * units for bulk-tracked items) as a whole number when it is one, or
 * trimmed to a single decimal place otherwise, so a row never shows
 * floating-point noise like "6.499999999999".
 */
export function formatStockQty(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 1 });
}
