import { itemPrice } from '@/lib/itemPrice';
import { TRACKING_SERIALIZED, type InventoryItem } from '@/types/inventory';
import { sizeFromItemMm, thicknessFromItemMm } from '@/lib/lineThickness';
import { isAreaUnit, itemDimensionUnit, withoutUnsupportedSize } from '@/lib/lineDimensions';
import type { PurchaseOrderLineItem } from '@/lib/purchaseOrderForm';

type LineDraft = Omit<PurchaseOrderLineItem, 'id' | 'lineNo'>;

/** A purchase order line after `item` is picked into it: the item's display
 *  fields, purchasing price and its own standard length, width and thickness,
 *  in the unit the line is measured in. `units` is the item's unit code (SQFT,
 *  EA, ...). Amounts are not worked out here — the caller recalculates. The
 *  server re-snapshots authoritatively from inventoryItemUuid at save time. */
export function withCatalogItem(prev: LineDraft, item: InventoryItem, units: string): LineDraft {
  const dimensionUnit = itemDimensionUnit(item);
  return withoutUnsupportedSize({
    ...prev,
    thickness: thicknessFromItemMm(item.thicknessMm, dimensionUnit, units),
    length: sizeFromItemMm(item.lengthMm, dimensionUnit, units),
    width: sizeFromItemMm(item.widthMm, dimensionUnit, units),
    itemName: item.name,
    units,
    tracking: item.tracking,
    // A slab count is kept for a slab-tracked item and for any area unit, where
    // it is the Slabs of a length x width x slabs line.
    expectedSlabs: item.tracking === TRACKING_SERIALIZED || isAreaUnit(units) ? prev.expectedSlabs : '',
    itemDescription: item.description,
    itemSku: item.sku,
    unitPrice: String(itemPrice(item, 'purchasing')),
    inventoryItemUuid: item.id,
    dimensionUnit,
  });
}
