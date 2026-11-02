// Shared types for the Reorder page — hand-mirrored from the Go structs in
// StoneSuite-Backend's `replenishment` package. Nothing here is stored: the
// list is worked out from usage, stock and open purchase orders every time.

/** How much of an item was used in one calendar month. */
export interface MonthUsage {
  /** YYYY-MM */
  month: string;
  used: number;
}

/** One purchase order that still has some of an item to arrive. */
export interface OpenOrder {
  id: string;
  number: string;
  status: string;
  remaining: number;
}

/** One item that stock plus open orders will not carry through next month. */
export interface ReorderItem {
  inventoryItemId: string;
  sku: string;
  name: string;
  tracking: string;
  /** "slabs" for a slab-tracked item, otherwise the item's own unit code. */
  unit: string;
  /** One entry per history month, oldest first. */
  usage: MonthUsage[];
  /** Average monthly usage over the history months, rounded up. */
  monthlyRequirement: number;
  onHand: number;
  onOrder: number;
  /** monthlyRequirement - onHand - onOrder; always > 0. */
  needed: number;
  /** The POs behind onOrder. Absent when the caller cannot read every
   *  purchase order — onOrder itself is still the full total. */
  openOrders?: OpenOrder[];
}

export interface ReorderList {
  /** The history months the usage columns cover, oldest first (YYYY-MM). */
  months: string[];
  items: ReorderItem[];
}

/** How much of the item to order from one vendor. */
export interface VendorQty {
  vendorId: string;
  qty: number;
}

export interface DraftInput {
  inventoryItemId: string;
  vendors: VendorQty[];
}

/** One draft purchase order that was created. */
export interface DraftedOrder {
  vendorId: string;
  purchaseOrderId: string;
}
