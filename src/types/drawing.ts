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

export type CutoutType = 'sink' | 'cooktop' | 'outlet' | 'faucet' | 'custom';

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

export interface Cutout {
  id: string;
  type: CutoutType;
  center: Point;
  widthMm?: number;
  depthMm?: number;
  diameterMm?: number;
  label?: string;
}

export interface Piece {
  id: string;
  label: string; // 'A-1'
  shape: 'rect' | 'L' | 'U' | 'polygon';
  outline: Point[]; // local coords, clockwise, closed implicitly
  position: Point;
  rotationDeg: 0 | 90 | 180 | 270;
  thicknessMm: number;
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
