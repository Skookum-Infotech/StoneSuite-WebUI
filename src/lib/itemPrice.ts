import type { InventoryItem } from '@/types/inventory';

/** Which of an item's two prices a document line defaults to: what the company
 *  sells it for (sales documents) or what it pays for it (purchasing documents). */
export type ItemPriceKind = 'selling' | 'purchasing';

/** The price an item defaults a document line to. An item from an API that
 *  predates the purchasing price has none and reads as its selling price, so a
 *  purchase line is never silently priced at zero. */
export function itemPrice(
  item: Pick<InventoryItem, 'unitPrice' | 'purchaseUnitPrice'>,
  kind: ItemPriceKind,
): number {
  if (kind === 'purchasing') return item.purchaseUnitPrice ?? item.unitPrice;
  return item.unitPrice;
}
