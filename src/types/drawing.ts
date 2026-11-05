// Library-neutral data model for the Sales Order countertop drawing editor.
// All geometry is millimetres; `displayUnit`/`fractionDenominator` are
// display-only (see lib/drawing/units.ts). This mirrors the Design Studio
// build spec §4 — not every field is consumed yet (the DXF export proof
// only needs `outline`, `label`, and `shape`), but the shape is fixed now
// so stored drawings don't need a migration once seams/cutouts/edges land.

export type Point = { x: number; y: number };

/** Tenant-defined edge marking (e.g. 'W' | 'E' | 'FP' | 'S' — see build spec
 *  §8, pending the shop's actual list). Left as `string` until that list
 *  is seeded; narrowing it later is additive, not breaking. */
export type EdgeCode = string;

export type CutoutType = 'sink' | 'cooktop' | 'faucet' | 'soap_dispenser' | 'outlet' | 'custom';

/** How a cutout's opening is drawn. `rect` uses widthMm x depthMm, `round`
 *  uses diameterMm, `polygon` uses its own `outline`. Absent on drawings
 *  saved before this field existed — see `cutoutShape` in lib/drawing/cutouts.ts. */
export type CutoutShape = 'rect' | 'round' | 'polygon';

/** What role a piece plays in the layout. Label/preset only — geometry is
 *  identical for every kind. */
export type PieceKind = 'countertop' | 'island' | 'peninsula';

export interface PieceEdge {
  index: number;
  code?: EdgeCode;
  overhangMm?: number;
  splashHeightMm?: number;
}

export interface Seam {
  from: Point;
  to: Point;
}

/** An opening in a piece. `center` and `outline` are in the piece's own local
 *  coordinates (the same space as `Piece.outline`), so a cutout moves and
 *  rotates with its piece. */
export interface Cutout {
  id: string;
  type: CutoutType;
  shape?: CutoutShape;
  center: Point;
  widthMm?: number;
  /** The opening's extent along its own Y axis (the "height" of a rect). */
  depthMm?: number;
  diameterMm?: number;
  /** Rotation of the opening about its own centre, in degrees. */
  rotationDeg?: number;
  /** Custom geometry, relative to `center`, for `shape: 'polygon'`. */
  outline?: Point[];
  /** Inventory item this opening is cut for (a sink, cooktop, faucet...). */
  inventoryItemId?: string;
  /** Edge treatment around the opening — a code from the tenant's edge list. */
  edgeCode?: EdgeCode;
  label?: string;
}

export interface Piece {
  id: string;
  label: string; // 'A-1'
  shape: 'rect' | 'L' | 'U' | 'polygon';
  kind?: PieceKind;
  outline: Point[]; // local coords, clockwise, closed implicitly
  position: Point;
  /** Clockwise rotation about the local origin, in degrees (any value). */
  rotationDeg: number;
  thicknessMm: number;
  cornerRadiusMm?: number;
  salesOrderLineId?: string;
  edges: PieceEdge[];
  seams: Seam[];
  cutouts: Cutout[];
}

export interface Note {
  id: string;
  text: string;
  at: Point;
  pieceId?: string;
}

export interface DrawingArea {
  id: string;
  name: string;
  code: string; // 'Kitchen', 'Kit'
  sortOrder: number;
  pieces: Piece[];
  cabinets: Point[][];
  notes: Note[];
}

export const DRAWING_SCHEMA_VERSION = 1;

export interface Drawing {
  schemaVersion: typeof DRAWING_SCHEMA_VERSION;
  salesOrderId: string;
  version: number;
  displayUnit: 'in' | 'mm';
  fractionDenominator: 16 | 32;
  areas: DrawingArea[];
  updatedAt: string;
  updatedBy: { id: string; name: string };
}
