import { EMPTY_LINE_ITEM, calcLineItem, type PurchaseOrderLineItem } from '@/lib/purchaseOrderForm';
import { withCatalogItem } from '@/lib/purchaseOrderCatalogLine';
import { isSized, sizedQuantity, withSizedQuantity } from '@/lib/lineDimensions';
import type { InventoryItem } from '@/types/inventory';
import type { StockShortage } from '@/types/salesOrder';

// Hands a Sales Order's stock shortfall to a new Purchase Order in the same tab.
// Each line is the short item picked exactly as the buyer would pick it — its
// own length, width, thickness and purchasing price — so a slab item is ordered
// in whole slabs of the size already stocked, enough to cover the shortfall.
// The vendor is left for the buyer to choose.

export const NEW_PURCHASE_ORDER_PATH = '/purchases/purchase_order/new';
const PREFILL_STATE_KEY = 'purchaseOrderPrefill';
const MAX_QTY_DECIMALS = 3;
/** Ignore float noise when counting slabs: 2.0000001 slabs' worth is 2 slabs. */
const SLAB_EPSILON = 1e-6;

/** The router state the new purchase order page reads its starting lines from. */
export type PurchaseOrderPrefillState = { [PREFILL_STATE_KEY]: PurchaseOrderLineItem[] };

function trimQty(n: number): string {
  return String(Number(n.toFixed(MAX_QTY_DECIMALS)));
}

/** The purchase order line that covers one item's shortfall. `units` is the
 *  item's unit code; blank falls back to the unit the shortage was counted in.
 *  A sized area item (one with a standard length and width) is ordered in whole
 *  slabs of that size — at least the shortfall, never less; anything else is
 *  ordered at exactly the shortfall. */
export function shortageLine(shortage: StockShortage, item: InventoryItem, units: string): Omit<PurchaseOrderLineItem, 'id' | 'lineNo'> {
  const picked = withCatalogItem(EMPTY_LINE_ITEM, item, units || shortage.unitCode);
  let line = { ...picked, quantity: trimQty(shortage.short) };
  if (isSized(picked, picked.units)) {
    const perSlab = parseFloat(sizedQuantity({ ...picked, slabs: '1' }, picked.units));
    if (perSlab > 0) {
      const slabs = String(Math.max(1, Math.ceil(shortage.short / perSlab - SLAB_EPSILON)));
      line = withSizedQuantity({ ...picked, expectedSlabs: slabs }, slabs);
    }
  }
  // Tax follows the header's Sales Tax %, which a new order starts without.
  return { ...line, ...calcLineItem(line, 0) };
}

/** The numbered lines for every short item, in the order given. */
export function purchaseOrderPrefillLines(
  shortages: StockShortage[],
  items: InventoryItem[],
  unitCodeFor: (item: InventoryItem) => string,
): PurchaseOrderLineItem[] {
  return shortages.map((s, i) => ({
    ...shortageLine(s, items[i], unitCodeFor(items[i])),
    id: `po-prefill-${i + 1}`,
    lineNo: i + 1,
  }));
}

export function purchaseOrderPrefillState(lines: PurchaseOrderLineItem[]): PurchaseOrderPrefillState {
  return { [PREFILL_STATE_KEY]: lines };
}

/** The lines handed over in router state, or null when there are none. */
export function purchaseOrderPrefillFrom(routerState: unknown): PurchaseOrderLineItem[] | null {
  if (typeof routerState !== 'object' || routerState === null) return null;
  const lines = (routerState as Record<string, unknown>)[PREFILL_STATE_KEY];
  if (!Array.isArray(lines) || lines.length === 0) return null;
  const ok = lines.every((l: unknown) => typeof l === 'object' && l !== null
    && typeof (l as Record<string, unknown>).itemName === 'string'
    && typeof (l as Record<string, unknown>).quantity === 'string');
  return ok ? (lines as PurchaseOrderLineItem[]) : null;
}
