import type { FilterClause, SortKey } from '@/types/tenant';

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
}

export interface Warehouse {
  id: string; // warehouse_uuid
  name: string;
  code: string;
  addrLine1: string;
  addrLine2: string;
  addrCity: string;
  addrStateId?: number | null;
  addrZip: string;
  isDefault: boolean;
  isActive: boolean;
  isSystem: boolean;
}

export interface WarehouseInput {
  name: string;
  code: string;
  addrLine1: string;
  addrLine2: string;
  addrCity: string;
  addrStateId?: number | null;
  addrZip: string;
  isActive: boolean;
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
  unitPrice: number;
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
  unitPrice: number;
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

// ── Units (slabs / remnants) ─────────────────────────────────────────────────

export const UNIT_KIND_SLAB = 'slab';
export const UNIT_KIND_REMNANT = 'remnant';

export const UNIT_STATUS_AVAILABLE = 'available';
export const UNIT_STATUS_RESERVED = 'reserved';
export const UNIT_STATUS_CONSUMED = 'consumed';
export const UNIT_STATUS_SCRAPPED = 'scrapped';
export const UNIT_STATUS_IN_TRANSIT = 'in_transit';

export interface InventoryUnit {
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

  form: string; // full | cut
  status: string; // available | reserved | consumed | scrapped | in_transit
  parentUnitId?: string | null;
  rootUnitId?: string | null;

  isUsableRemnant: boolean;
  grade?: string;
  finish?: string;
  finishId?: number | null;
  photoKey?: string;

  createdAt: string;
  updatedAt: string;
}

// Offcuts minted by a cut are never created through this path — only whole
// pieces received into stock. `area`, if sent, is ignored: it's always
// computed server-side from the mm dimensions into the item's own unit.
export interface CreateUnitInput {
  serial: string;
  vendorId?: number | null;
  supplierCode?: string;
  barcode?: string;
  inventoryItemId: string;
  warehouseId: number;
  binId?: string | null;
  bundleUuid?: string | null;
  bundleId?: string;
  blockId?: string;
  lot?: string;
  lengthMm: number;
  widthMm: number;
  thicknessMm: number;
  grade?: string;
  finishId?: number | null;
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

export interface MoveUnitInput {
  binId?: string | null;
  note?: string;
}

export interface ScrapUnitInput {
  reasonId: number;
  note?: string;
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
