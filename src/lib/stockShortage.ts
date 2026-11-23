import { unitLabel } from '@/lib/unitLabels';
import type { StockShortage } from '@/types/salesOrder';

// A Sales Order is never refused for want of stock: the server saves it, holds the
// full quantity as a backorder, and lists what inventory does not have in stock
// (`stockShortages`, backend inventory/allocation_shortage.go). Part of that gap
// may already be on its way on a sent purchase order (`onOrder`); the rest is
// `short`. These helpers turn that list into the warnings.

const MAX_QTY_DECIMALS = 3;

/** "45.208 sq ft", "12 each" — a quantity with what it is measured in, trimmed
 *  of trailing zeros (a count is not shown as 12.000). */
export function formatStockQty(value: number, unitCode?: string): string {
  const number = value.toLocaleString('en-US', { maximumFractionDigits: MAX_QTY_DECIMALS });
  const unit = unitLabel(unitCode).toLowerCase();
  return unit ? `${number} ${unit}` : number;
}

/** The items nothing covers yet — not in stock, not on a sent purchase order. */
export function uncoveredShortages(shortages: StockShortage[]): StockShortage[] {
  return shortages.filter((s) => s.short > 0);
}

/** The items a sent purchase order is bringing (some or all of the gap). */
export function onOrderShortages(shortages: StockShortage[]): StockShortage[] {
  return shortages.filter((s) => (s.onOrder ?? 0) > 0);
}

/** "1 item short" / "2 items short". */
export function itemsShortLabel(shortages: StockShortage[]): string {
  return `${shortages.length} ${shortages.length === 1 ? 'item' : 'items'} short`;
}

function joinList(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

/** "GRN (short 156.25 sq ft) and MRB (short 312.5 sq ft)" — every item, by SKU, with what is uncovered. */
export function shortItemsSentence(shortages: StockShortage[]): string {
  return joinList(shortages.map((s) => `${s.sku || s.name} (short ${formatStockQty(s.short, s.unitCode)})`));
}

/** "GRN (156.25 sq ft on PORD-000012)" — every item, by SKU, with what is on its way and on which orders. */
export function onOrderSentence(shortages: StockShortage[]): string {
  return joinList(shortages.map((s) => {
    const orders = (s.purchaseOrders ?? []).filter(Boolean);
    const on = orders.length ? ` on ${joinList(orders)}` : ' on order';
    return `${s.sku || s.name} (${formatStockQty(s.onOrder ?? 0, s.unitCode)}${on})`;
  }));
}

/** The toast right after a save: "SO-1042 created. 2 items short in inventory." */
export function shortageToastMessage(orderNumber: string, verb: 'created' | 'saved', shortages: StockShortage[]): string {
  return `${orderNumber || 'Sales order'} ${verb}. ${itemsShortLabel(shortages)} in inventory.`;
}
