import type { FilterClause, SortKey } from '@/types/tenant';
import type { CompanyLocation } from '@/types/companyProfile';

// Shared types for the Inventory module — hand-mirrored from the Go structs
// in the StoneSuite-Backend `inventory`, `inventoryadjustment`,
// `inventorytransfer` and `inventorycount` packages (feat/inventory-module).

// ── Lookups (vocabularies) ───────────────────────────────────────────────────

export type LookupKind = 'materials' | 'colors' | 'finishes' | 'reasons' | 'units' | 'tax-rates';

// Vocabularies the API accepts a POST/PATCH/DELETE for — 'units' and
// 'tax-rates' are read-only server-side (see inventory/lookups.go) and 400 on
// write, so they're excluded here rather than trusted to a UI-side check.
export const WRITABLE_LOOKUP_KINDS: LookupKind[] = ['materials', 'colors', 'finishes', 'reasons'];

export interface LookupItem {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
  isSystem: boolean;
  // Vocabulary-specific columns: isPorous (materials), hex/materialId
  // (colors), appliesTo/direction (reasons), category (units — count | length
  // | area | volume | weight — drives whether an item form prompts for
  // dimensions), percent (tax-rates).
  extra?: Record<string, unknown>;
}

export interface LookupInput {
  name: string;
  code: string;
  isActive?: boolean;
  extra?: Record<string, unknown>;
  // Colors-only: a '#RRGGBB' swatch (see inventory/lookups_store.go's
  // colorHex regex). Flat, not nested under `extra` — the Go LookupInput
  // struct this maps to reads it as a top-level `hex` field. Ignored
  // server-side for every other vocabulary.
  hex?: string;
}

// A place stock is held: one of the tenant's Company Info locations (Configuration
// → Company Info → Locations), which is the only place they are created, edited,
// made the default or deleted. The Inventory module calls them Locations; the
// type keeps its old name so the document write contracts are untouched. Same
// shape as CompanyLocation (types/companyProfile.ts) plus the numeric id.
export interface Warehouse extends CompanyLocation {
  /** The numeric company_location id — what document write contracts (units,
   *  receipts, transfers, ...) take as a foreign key; `id` is the uuid. */
  warehouseId: number;
}

// All vocabularies in one payload — what an item, unit or bin form loads on
// open (GET /inventory/lookups). `colors` ships empty by design (colour names
// are vendor-catalogue names; seeding would collide with a tenant's real
// import) — the colour picker must offer inline "+ Add colour".
export interface AllLookups {
  materials: LookupItem[];
  colors: LookupItem[];
  finishes: LookupItem[];
  reasons: LookupItem[];
  units: LookupItem[];
  'tax-rates': LookupItem[];
  warehouses: Warehouse[];
  binTypes: string[];
  unitKinds: string[];
  trackingModes: string[];
  bundleStatuses: string[];
}

// unit_category values, mirrored from lkp_unit.extra.category. Only 'count'
// items skip dimension prompts everywhere else in this module.
export type UnitCategory = 'count' | 'length' | 'area' | 'volume' | 'weight';

// ── Inventory item (catalogue) ───────────────────────────────────────────────

export const TRACKING_QUANTITY = 'quantity';
export const TRACKING_SERIALIZED = 'serialized';
export type TrackingMode = typeof TRACKING_QUANTITY | typeof TRACKING_SERIALIZED;

export interface InventoryItem {
  id: string; // inventory_item_uuid
  sku: string;
  name: string;
  description: string;
  unitId: number;
  /** The SELLING price — what a sales document line defaults to. */
  unitPrice: number;
  /** What a purchase order, vendor bill or requisition line defaults to. The API
   *  always sends it; optional here so a hand-built item (a test fixture) still
   *  type-checks — read it through `itemPrice()`, where absent means the selling
   *  price. */
  purchaseUnitPrice?: number;
  currencyId?: number | null;
  taxRateId?: number | null;
  isActive: boolean;
  customFields: Record<string, unknown>;

  tracking: TrackingMode;
  materialId?: number | null;
  colorId?: number | null;
  finishId?: number | null;
  thicknessMm: number;
  originCountryId?: number | null;
  barcode: string;
  defaultWarehouseId?: number | null;
  /** The unit this item's slabs' length and width are measured in: mm, cm, in, ft
   *  or m. A document line copies it when the item is picked. The API always sends
   *  it; optional here so a hand-built item (a test fixture) still type-checks —
   *  read it through itemDimensionUnit(), where absent means cm. */
  dimensionUnit?: string;
  /** Whether a sales order line for this item is checked against stock and
   *  reserves it. Off for a service/delivery/labour item; always on for a slab
   *  item. The API always sends it; optional here so a hand-built item (a test
   *  fixture) still type-checks — absent reads as on. */
  trackStock?: boolean;
  /** The kits this item is in. Sent by the single-item GET only; list and
   *  search rows leave it out. */
  kits?: KitRef[];

  createdAt: string;
  updatedAt: string;
}

// Full-object write shape — Update reuses this and overwrites every field
// (PATCH has PUT semantics server-side). Never send a partial object.
export interface InventoryItemInput {
  sku: string;
  name: string;
  description: string;
  unitId: number;
  /** Selling price. Required by the API, as is `purchaseUnitPrice`. */
  unitPrice: number;
  purchaseUnitPrice: number;
  currencyId?: number | null;
  taxRateId?: number | null;
  customFields: Record<string, unknown>;

  tracking: TrackingMode;
  materialId?: number | null;
  colorId?: number | null;
  finishId?: number | null;
  thicknessMm: number;
  originCountryId?: number | null;
  barcode: string;
  defaultWarehouseId?: number | null;
  /** mm, cm, in, ft or m. Omit to leave the item's unit as it is. */
  dimensionUnit?: string;
  trackStock?: boolean;
  /** When present, makes exactly these kits (ids) the item's kits. Omit to
   *  leave its memberships alone; `[]` takes the item out of every kit. */
  kitIds?: string[];
}

export interface InventoryItemPage {
  records: InventoryItem[];
  nextCursor: string;
  hasMore: boolean;
}

export interface InventoryItemSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface InventoryItemHistoryEntry {
  action: string;
  at: string;
  byName: string;
  details?: Record<string, unknown>;
}

// ── Stock (on hand) ──────────────────────────────────────────────────────────
// Served from `/api/tenant/inventory/items/{uuid}/stock` and
// `/api/tenant/inventory/stock/*`, under the `inventory_item` grant. Mirrors the
// Go structs in StoneSuite-Backend `inventory/stock.go`. Every figure is in the
// item's own unit; `available` is worked out by the server and is never
// recalculated here.

/** One item's stock at one location. */
export interface StockRow {
  itemId: string;
  sku: string;
  itemName: string;
  tracking: TrackingMode;
  unitCode: string;
  warehouseId: number;
  warehouseName: string;
  onHand: number;
  /** What open sales orders still hold. */
  allocated: number;
  /** On hand less allocated, never negative. */
  available: number;
  /** 0 means no reorder point is set. */
  reorderPoint: number;
}

/** One item's stock summed over every location, for a list row. */
export interface StockTotal {
  unitCode: string;
  onHand: number;
  allocated: number;
  available: number;
  /** Locations the item is held in. */
  locations: number;
  /** True when any location is at or below its (non-zero) reorder point. */
  belowReorder: boolean;
}

export interface ReorderPointInput {
  itemId: string;
  warehouseId: number;
  reorderPoint: number;
}

// ── Kits ─────────────────────────────────────────────────────────────────────
// A kit is a named group of catalogue items sold together ("Kitchen"). Picking
// one on a document line adds its items as ordinary lines under a kit heading.
// Served from `/api/tenant/inventory/kits*` under the `inventory_item` grant;
// mirrors the Go structs in StoneSuite-Backend `inventory/kit_types.go`.

/** The light kit reference an item carries. */
export interface KitRef {
  id: string;
  name: string;
}

/** One item a kit holds and the quantity a line gets by default. `item` is the
 *  full catalogue record — what an item search returns — so a kit is added to a
 *  line table through the code that adds an item. */
export interface KitMember {
  quantity: number;
  item: InventoryItem;
}

export interface InventoryKit {
  id: string; // inventory_kit_uuid
  name: string;
  description: string;
  isActive: boolean;
  /** Live items in the kit; set on every read. */
  itemCount: number;
  /** Present on the single-kit GET only — list and search rows carry the count. */
  members?: KitMember[];
  createdAt: string;
  updatedAt: string;
}

export interface KitMemberInput {
  /** The item's id (its uuid). */
  itemId: string;
  /** Omitted or 0 reads as 1 server-side. */
  quantity: number;
}

// Whole-object write, like items. `members` omitted leaves the kit's items
// alone; an explicit empty list empties it. `isActive` omitted leaves it as is.
export interface KitInput {
  name: string;
  description: string;
  isActive?: boolean;
  members?: KitMemberInput[];
}

export interface KitPage {
  records: InventoryKit[];
  nextCursor: string;
  hasMore: boolean;
}

export interface KitSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

// ── Units (slabs / remnants) ─────────────────────────────────────────────────

export const UNIT_KIND_SLAB = 'slab';
export const UNIT_KIND_REMNANT = 'remnant';

export const UNIT_STATUS_AVAILABLE = 'available';
export const UNIT_STATUS_RESERVED = 'reserved';
export const UNIT_STATUS_CONSUMED = 'consumed';
export const UNIT_STATUS_SCRAPPED = 'scrapped';
export const UNIT_STATUS_IN_TRANSIT = 'in_transit';
/** A slab minted when its purchase order was sent: not stock, not arrived. */
export const UNIT_STATUS_ON_ORDER = 'on_order';
/** A slab that arrived on an item receipt with no bin: in stock, not put away yet.
 *  Placing it in a bin (a Bin Transfer) makes it available. */
export const UNIT_STATUS_RECEIVED = 'received';

/** Consumption picture for one unit. A unit is cut whole: its area leaves stock
 *  in full, `recoveredArea` comes back as offcut units, and `usedArea` — what
 *  did not come back — went into finished product and saw kerf. Recovered and
 *  used are only non-zero on a consumed unit. */
export interface UnitUsage {
  /** Fabrication job holding (reserved) or that cut (consumed) the unit. */
  jobId?: string;
  jobNumber?: string;
  /** The customer's sales order that job is for. */
  salesOrderId?: string;
  salesOrderNumber?: string;
  reservedAt?: string | null;
  consumedAt?: string | null;
  scrappedAt?: string | null;
  offcutCount: number;
  recoveredArea: number;
  usedArea: number;
}

export interface InventoryUnit {
  inspectionStatus?: 'legacy' | 'pending' | 'accepted' | 'rejected';
  id: string;
  serial: string;
  kind: string; // slab | remnant
  vendorId?: number | null;
  supplierCode: string;
  barcode: string;

  inventoryItemId: string;
  inventoryItemName?: string;
  inventoryItemSku?: string;

  warehouseId: number;
  warehouseName?: string;
  binId?: string | null;
  binPath?: string;

  bundleId?: string;
  bundleUuid?: string | null;
  blockId?: string;
  lot?: string;

  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  area: number;
  areaUnitId: number;
  /** Code of `areaUnitId` (SQFT, SQM…) — what `area` is measured in. */
  areaUnitCode?: string;

  form: string; // full | cut
  status: string; // on_order | available | reserved | consumed | scrapped | in_transit
  parentUnitId?: string | null;
  /** Serial of the parent / root unit, to show lineage by name. */
  parentSerial?: string;
  rootUnitId?: string | null;
  rootSerial?: string;

  /** What has become of this unit's stone. Always sent by the API; optional
   *  here so a hand-built unit (a test fixture) still type-checks. */
  usage?: UnitUsage;

  isUsableRemnant: boolean;
  grade?: string;
  finish?: string;
  finishId?: number | null;
  photoKey?: string;

  /** The item receipt that brought this unit into stock — a unit only enters
   *  inventory by receiving it against a purchase order. Absent for a
   *  remnant cut in the yard and for units that predate receipt-linked slabs. */
  receiptId?: string | null;
  receiptNumber?: string;

  /** The purchase order this unit was ordered on — set for a slab minted when its
   *  order was sent (it names the order while the slab is On Order, and stays as
   *  the order of origin once it has arrived). Absent for every other unit. */
  purchaseOrderId?: string | null;
  purchaseOrderNumber?: string;

  /** The customer this unit is held for when it was reserved from Inventory (a
   *  reservation a fabrication job holds is named by `usage.jobId` instead). */
  reservedCustomerId?: string | null;
  reservedCustomerName?: string;
  customerReservedAt?: string | null;

  createdAt: string;
  updatedAt: string;
}

export interface UnitPage {
  records: InventoryUnit[];
  nextCursor: string;
  hasMore: boolean;
}

export interface UnitSearchRequest {
  filters?: FilterClause[];
  sort?: SortKey[];
  limit?: number;
  cursor?: string;
  search?: string;
}

export interface ReserveUnitInput {
  /** The customer's uuid (a customer record's id). */
  customerId: string;
  note?: string;
}

export interface ScrapUnitInput {
  reasonId: number;
  note?: string;
}

export interface UnitHistoryEntry {
  action: string;
  field: string;
  oldValue: string;
  newValue: string;
  fromBin?: string;
  toBin?: string;
  reason?: string;
  note?: string;
  /** The bin transfer that made a bin_move, when one did. */
  transferId?: string;
  transferNumber?: string;
  at: string;
  byName: string;
}

// ── Bin history ───────────────────────────────────────────────────────────

/** Whether a unit arrived in a bin, left it, or was only named on the event. */
export type BinHistoryDirection = 'in' | 'out' | 'other';

/** One event on a bin — read from the units' own movement history, so it covers
 *  every route in and out of the bin, not only bin transfers. */
export interface BinHistoryEntry {
  /** bin_move, create, cut, scrap, warehouse_move, remnant_created… */
  action: string;
  direction: BinHistoryDirection;
  unitId: string;
  unitSerial: string;
  inventoryItemName?: string;
  /** The two ends of the movement; whichever is the bin itself is that bin. */
  fromBinPath?: string;
  toBinPath?: string;
  note?: string;
  transferId?: string;
  transferNumber?: string;
  at: string;
  byName: string;
}

export interface BinHistoryPage {
  records: BinHistoryEntry[];
  nextCursor: string;
  hasMore: boolean;
}

// ── Cutting ───────────────────────────────────────────────────────────────

export interface CutPiece {
  serial: string;
  barcode?: string;
  lengthMm: number;
  widthMm: number;
  grade?: string;
}

// Only the offcuts being kept are listed — material that leaves inventory as
// a finished countertop is never listed here; it leaves with the parent.
export interface CutUnitInput {
  remnants: CutPiece[];
  minUsableLengthMm: number; // shop policy; 0 = keep everything
  minUsableWidthMm: number;
  reasonId?: number | null;
  note?: string;
}

export interface CutResult {
  parent: InventoryUnit;
  remnants: InventoryUnit[];
  consumedArea: number;
  recoveredArea: number;
  lostArea: number; // kerf + product that left with the parent — reported, not a stock movement
}

// ── Bins ──────────────────────────────────────────────────────────────────

export const BIN_TYPES = ['yard', 'rack', 'aframe', 'aisle', 'shelf', 'floor', 'staging'] as const;
export type BinType = (typeof BIN_TYPES)[number];

export interface Bin {
  id: string;
  warehouseId: string;
  warehouseName?: string;
  code: string;
  name: string;
  type: string;
  parentId?: string | null;
  path: string;
  depth: number;
  capacityUnits: number;
  capacityArea: number;
  isActive: boolean;
  isWip?: boolean;
  machineLabel?: string;
  isSystem: boolean;
  notes: string;
  createdAt: string;
  updatedAt: string;

  // Advisory only — never blocks a move.
  unitCount: number;
  overCapacity: boolean;

  children?: Bin[];
}

export interface BinInput {
  warehouseId: string;
  code: string;
  name: string;
  type: string;
  parentId?: string | null;
  capacityUnits: number;
  capacityArea: number;
  isActive: boolean;
  isWip?: boolean;
  machineLabel?: string;
  notes: string;
}

// ── Bundles ───────────────────────────────────────────────────────────────

export const BUNDLE_OPEN = 'open';
export const BUNDLE_SEALED = 'sealed';
export const BUNDLE_BROKEN = 'broken';

export interface Bundle {
  id: string;
  code: string;
  status: string; // open | sealed | broken
  vendorId?: number | null;
  supplierCode?: string;
  blockId?: string;
  lot?: string;

  inventoryItemId?: string | null;
  inventoryItemName?: string;

  warehouseId: number;
  warehouseName?: string;
  binId?: string | null;
  binPath?: string;

  receivedAt?: string | null;
  notes?: string;

  memberCount: number;
  totalArea: number;

  createdAt: string;
  updatedAt: string;
}

// On update, an omitted inventoryItemId/binId (absent from the JSON) leaves
// that field untouched server-side; send "" to clear it explicitly. Every
// other field is written as sent.
export interface BundleInput {
  code: string;
  vendorId?: number | null;
  supplierCode?: string;
  blockId?: string;
  lot?: string;
  inventoryItemId?: string;
  warehouseId: number;
  binId?: string;
  receivedAt?: string | null;
  notes?: string;
  memberIds?: string[];
}

export interface BundleMemberInput {
  memberIds: string[];
  note?: string;
}

export interface MoveBundleInput {
  binId?: string | null;
  note?: string;
}

// ── Document primitives shared by adjustment / transfer / count ─────────────

export interface DocHistoryEntry {
  action: string;
  fromStatus?: string;
  toStatus?: string;
  at: string;
  byName: string;
}

// ── Adjustments (IADJ) ───────────────────────────────────────────────────────

export interface AdjustmentLine {
  id: string;
  lineNumber: number;
  inventoryItemId: string;
  inventoryItemName?: string;
  sku?: string;
  inventoryUnitId?: string | null;
  unitSerial?: string;
  reasonId: number;
  reasonName?: string;
  unitCode?: string;
  qtyDelta: number;
  notes?: string;
}

export interface Adjustment {
  id: string;
  number: string;
  statusId: number;
  statusCode: string;
  statusName: string;
  warehouseId: number;
  warehouseName?: string;
  date: string;
  reasonId?: number | null;
  reasonName?: string;
  notes?: string;
  internalNotes?: string;
  ownerId?: number | null;
  ownerName?: string;
  postedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string;
  netDelta: number;
  lines: AdjustmentLine[];
  createdAt: string;
  updatedAt: string;
}

export interface AdjustmentLineInput {
  inventoryItemId: string;
  inventoryUnitId?: string | null;
  reasonId: number;
  qtyDelta: number; // ignored for a serialized line except its SIGN
  notes?: string;
}

export interface AdjustmentInput {
  warehouseId: number;
  date: string;
  reasonId?: number | null;
  notes?: string;
  internalNotes?: string;
  ownerId?: number | null;
  lines: AdjustmentLineInput[];
}

export interface AdjustmentPage {
  records: Adjustment[];
  nextCursor: string;
  hasMore: boolean;
}

// ── Transfers (ITRF) ──────────────────────────────────────────────────────

export interface TransferLine {
  id: string;
  lineNumber: number;
  inventoryItemId: string;
  inventoryItemName?: string;
  sku?: string;
  inventoryUnitId?: string | null;
  unitSerial?: string;
  unitCode?: string;
  qty: number;
  notes?: string;
}

export interface Transfer {
  id: string;
  number: string;
  statusId: number;
  statusCode: string;
  statusName: string;
  fromWarehouseId: number;
  fromWarehouseName?: string;
  toWarehouseId: number;
  toWarehouseName?: string;
  toBinId?: string | null;
  toBinPath?: string;
  date: string;
  expectedDate?: string | null;
  carrier?: string;
  trackingNumber?: string;
  notes?: string;
  internalNotes?: string;
  ownerId?: number | null;
  shippedAt?: string | null;
  receivedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string;
  totalQty: number;
  lines: TransferLine[];
  createdAt: string;
  updatedAt: string;
}

export interface TransferLineInput {
  inventoryItemId: string;
  inventoryUnitId?: string | null;
  qty: number; // ignored for a serialized line — the slab moves whole
  notes?: string;
}

export interface TransferInput {
  fromWarehouseId: number;
  toWarehouseId: number;
  toBinId?: string | null;
  date: string;
  expectedDate?: string | null;
  carrier?: string;
  trackingNumber?: string;
  notes?: string;
  internalNotes?: string;
  ownerId?: number | null;
  lines: TransferLineInput[];
}

export interface TransferPage {
  records: Transfer[];
  nextCursor: string;
  hasMore: boolean;
}

// ── Counts (ICNT) ─────────────────────────────────────────────────────────

export interface CountLine {
  id: string;
  lineNumber: number;
  inventoryItemId: string;
  inventoryItemName?: string;
  sku?: string;
  inventoryUnitId?: string | null;
  unitSerial?: string;
  binPath?: string;
  unitCode?: string;
  reasonId?: number | null;
  reasonName?: string;
  systemQty: number;
  // null = not counted yet — distinct from counted zero. Render differently.
  countedQty?: number | null;
  variance?: number | null;
  isUnexpected: boolean;
  countedAt?: string | null;
  notes?: string;
}

export interface Count {
  id: string;
  number: string;
  statusId: number;
  statusCode: string;
  statusName: string;
  warehouseId: number;
  warehouseName?: string;
  binId?: string | null;
  binPath?: string;
  date: string;
  frozenAt?: string | null;
  notes?: string;
  internalNotes?: string;
  ownerId?: number | null;
  postedAt?: string | null;
  cancelledAt?: string | null;
  cancelReason?: string;
  lineCount: number;
  countedCount: number;
  varianceCount: number;
  netVariance: number;
  lines: CountLine[];
  createdAt: string;
  updatedAt: string;
}

export interface CountInput {
  warehouseId: number;
  binId?: string | null;
  date: string;
  notes?: string;
  internalNotes?: string;
  ownerId?: number | null;
}

// A slab is binary — a scanner sends `found`, not a quantity.
export interface CountEntry {
  lineId: string;
  countedQty?: number | null;
  found?: boolean | null;
  reasonId?: number | null;
  notes?: string;
}

export interface UnexpectedEntry {
  inventoryUnitId: string;
  reasonId?: number | null;
  notes?: string;
}

export interface CountPage {
  records: Count[];
  nextCursor: string;
  hasMore: boolean;
}
