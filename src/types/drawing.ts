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

/** `sink` … `other` are the master-data types every tenant is seeded with
 *  (lkp_cutout_type); `soap_dispenser`, `outlet` and `custom` are older ones,
 *  still valid on drawings saved before the list moved to master data. */
export type CutoutType =
  | 'sink' | 'cooktop' | 'faucet' | 'fireplace' | 'bathtub' | 'other'
  | 'soap_dispenser' | 'outlet' | 'custom';

/** How the distance from one side of a cutout to the piece's edge is shown:
 *  measured from the cutout's centre, from its border, or not at all. */
export type DistanceLineMode = 'center' | 'border' | 'hidden';

export interface DistanceLines {
  top: DistanceLineMode;
  right: DistanceLineMode;
  bottom: DistanceLineMode;
  left: DistanceLineMode;
}

/** How a cutout's opening is drawn. `rect`, `ellipse`, `arc` (flat bottom,
 *  domed top) and `stadium` (a rectangle with fully rounded ends) all fill
 *  widthMm x depthMm; `round` uses diameterMm, `polygon` its own `outline`.
 *  Absent on drawings saved before this field existed — see `cutoutShape` in
 *  lib/drawing/cutouts.ts. */
export type CutoutShape = 'rect' | 'round' | 'polygon' | 'ellipse' | 'arc' | 'stadium';

/** What role a piece plays in the layout. Label/preset only — geometry is
 *  identical for every kind. */
export type PieceKind = 'countertop' | 'island' | 'peninsula';

/** The Border tool's reshapes (lib/drawing/borders.ts). */
export type BorderStyle = 'fullRadiusOut' | 'fullRadiusIn' | 'bumpOut' | 'bumpIn' | 'arcBumpOut' | 'arcBumpIn';

/** The Corner tool's changes (lib/drawing/corners.ts). */
export type CornerStyle = 'clip' | 'radius' | 'radiusIn' | 'bumpOut' | 'bumpIn' | 'notch';

/** The profile an edge type will show in 3D (lib/drawing/edgeTypes.ts lists them
 *  with their names). `none` is a plain square edge. Not drawn on the sketch. */
export type EdgeFinish = 'none' | 'raw' | 'ogee' | 'beveled' | 'eased' | 'waterfall' | 'halfBullnose' | 'bullnose';

/** How an edge type is priced. Only a rate per linear length so far. */
export type EdgePricingType = 'linear';

/** One kind of edge the Edges tool paints onto a side (Ease, Appliance ...): the
 *  shop's own list, kept on the server (GET /tenant/settings/edge-types). */
export interface EdgeType {
  id: string;
  name: string;
  pricingType: EdgePricingType;
  /** The rate, per linear unit of the type's pricing. */
  price: number;
  /** A short tag (e.g. "A"); may be empty. */
  alias: string;
  /** The colour the side is drawn in, as #rrggbb. */
  color: string;
  finish: EdgeFinish;
  /** One of the four every shop starts with. They can be edited, not duplicated. */
  isSystem: boolean;
}

export interface PieceEdge {
  index: number;
  /** Edge profile — a code from the tenant's edge list (lkp_edge_code). */
  code?: EdgeCode;
  /** How far the stone projects past its support. Informational. */
  overhangMm?: number;
  /** Backsplash standing along this side. */
  splashHeightMm?: number;
  /** Waterfall panel dropping from this side. */
  waterfallHeightMm?: number;
  /** Bows this side into a circular arc: the gap between the chord (corner to
   *  corner) and the arc's crown, in mm. Positive bulges to the left of corner
   *  i -> i+1 — away from the stone on the usual clockwise outline — negative
   *  to the right. Absent is a straight side. See lib/drawing/arcs.ts. */
  arcHeightMm?: number;
  /** Set on every side a Border reshape made (one id per reshape, shared by all
   *  its sides): a side with it already carries a border and must be made
   *  standard again before another can go on. `borderStyle` says which. */
  borderId?: string;
  borderStyle?: BorderStyle;
  /** Same idea for the Corner tool: set on every side a corner change made, one
   *  id per change. Such a side takes no second corner change or border until the
   *  corner is made standard again. */
  cornerId?: string;
  cornerStyle?: CornerStyle;
  /** The edge type the Edges tool painted onto this side (EdgeType.id). Absent is
   *  a side nobody has painted. */
  edgeTypeId?: string;
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
  /** Leave the name / the size text off the drawing (the two Hide boxes in
   *  the Cutout dialog). The opening itself is always drawn. */
  hideName?: boolean;
  hideMeasurements?: boolean;
  /** Which picture the opening is drawn as (lib/drawing/cutoutShapes.ts, e.g.
   *  `sink.farmhouse`). Absent is "No Picture": the plain rectangle. */
  shapeCode?: string;
  /** Faucet holes drilled with a sink; the radius is in mm. */
  faucetHoleCount?: number;
  faucetHoleRadiusMm?: number;
  distanceLines?: DistanceLines;
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
  /** Where the Material tab laid this piece on a slab; absent until it is placed.
   *  A piece sits on one slab at a time. */
  slab?: SlabPlacement;
}

/** A piece's spot on one inventory slab. The piece's outline is flipped to
 *  y-down, rotated clockwise by `rotationDeg` about its own origin, then moved so
 *  the top-left of its bounding box sits at (x, y) millimetres from the slab's
 *  top-left corner. `slabId` is the inventory unit's uuid. */
export interface SlabPlacement {
  slabId: string;
  x: number;
  y: number;
  rotationDeg: number;
}

export interface Note {
  id: string;
  /** May hold several lines (the Text tool's textarea). */
  text: string;
  at: Point;
  pieceId?: string;
  /** Text-tool formatting; absent on a plain note. `fontSize` is in screen
   *  pixels — a note keeps its size on screen at any zoom. */
  bold?: boolean;
  italic?: boolean;
  fontSize?: number;
}

/** A manual measurement between two points, in the area's world millimetres.
 *  `offsetMm` pushes the drawn line to the left of from -> to. */
export interface Dimension {
  id: string;
  from: Point;
  to: Point;
  offsetMm: number;
}

export interface DrawingArea {
  id: string;
  name: string;
  code: string; // 'Kitchen', 'Kit'
  sortOrder: number;
  pieces: Piece[];
  cabinets: Point[][];
  notes: Note[];
  /** Manual dimensions; absent on drawings saved before they existed. */
  dimensions?: Dimension[];
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
