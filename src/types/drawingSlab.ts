import type { InventoryUnit } from './inventory';

/** A slab or remnant as the drawing's Material tab sees it: the inventory unit,
 *  plus a short-lived link to its photo ('' or absent when it has none). */
export interface DrawingSlabUnit extends InventoryUnit {
  photoUrl?: string;
}

/** One slab-tracked item on the sales order and the units of it the drawing can use:
 *  slabs free to add, and those the order already holds or a job has taken. */
export interface DrawingSlabItem {
  itemId: string;
  itemName: string;
  itemSku: string;
  units: DrawingSlabUnit[];
}
