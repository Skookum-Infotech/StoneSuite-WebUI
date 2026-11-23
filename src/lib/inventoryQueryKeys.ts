// Query-key roots for everything a change in stock can make stale: the unit
// list and detail, the item list and detail (on-hand quantities), the remnant
// finder, and the bin tree (per-bin unit counts). Posting or voiding an item
// receipt adds or removes slabs, so both invalidate all of them.
//
// Kept out of a component/hook file so it can be shared without tripping the
// react-refresh lint rule about non-component exports.
export const INVENTORY_STOCK_QUERY_KEYS: ReadonlyArray<readonly [string]> = [
  ['inventory-units'],
  ['inventory-unit'],
  ['inventory-items'],
  ['inventory-item'],
  ['inventory-remnants'],
  ['inventory-bins-tree'],
];
