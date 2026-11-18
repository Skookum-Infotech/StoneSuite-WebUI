// Turns one drawing area into the flat description the 3D viewer extrudes: each piece's
// outline (curved sides sampled, moved to world position) with its cutouts as holes, its
// thickness, backsplash/waterfall walls, seams and (when it sits on a photographed slab) its
// texture; plus the cabinets under the counter. Pure data — no three.js here — so it is
// unit-testable without WebGL.
//
// World space is the 2D editor's own (millimetres, y-up). The viewer maps it into 3D by
// laying the shape flat (shape y -> depth, extrusion -> up), so nothing is re-derived
// here and 3D always agrees with what is on the board.

import type { DrawingArea, EdgeFinish, EdgeType, Piece, Point } from '@/types/drawing';
import { cutoutOutline } from '../cutouts';
import { edgeAt } from '../edges';
import { bounds, transformOutline } from '../geometry';
import { isSimplePolygon, pointInPolygon } from '../polygon';
import { COUNTER_HEIGHT_MM, DEFAULT_PIECE_THICKNESS_MM, MIN_OUTLINE_POINTS } from './constants';
import { sampleSides, shapesEdge } from './edgeProfile';
import { buildPanels, type PanelSolid } from './panels';
import { clipSegmentToPolygon, type Segment } from './seamLines';
import { resolveTexture, type PieceTexture, type SlabPhoto, type SlabPhotoStatus } from './slabTexture';

export interface PieceSolid {
  id: string;
  label: string;
  /** World outline, curved sides already sampled. */
  outline: Point[];
  /** World outlines of the openings that sit fully inside the stone. */
  holes: Point[][];
  thicknessMm: number;
  /** Height of the underside above the floor. */
  baseMm: number;
  panels: PanelSolid[];
  /** Seams in world space, already cut back to the stone. */
  seams: Segment[];
  /** Finish of each outline segment (outline[i] to outline[i + 1]), or null when every side
   *  is square. */
  segmentFinishes: EdgeFinish[] | null;
  /** World outlines of the sink openings, which get a bowl under them. */
  bowls: Point[][];
  /** The slab photo for the top face, when the piece fits on a slab that has one. */
  texture: PieceTexture | null;
  /** Why the piece does or does not show a photo (for the viewer's notices). */
  slabPhoto: SlabPhotoStatus;
}

export interface CabinetSolid {
  id: string;
  outline: Point[];
  heightMm: number;
}

export interface SolidsBounds {
  centerX: number;
  centerY: number;
  /** Longest side of the box round every piece, never zero. */
  sizeMm: number;
}

export interface AreaSolids {
  pieces: PieceSolid[];
  cabinets: CabinetSolid[];
  /** Pieces left out because their outline is unusable (too few points, or crossing itself). */
  skipped: number;
  bounds: SolidsBounds;
}

/** What is known beyond the one area: every piece in the drawing (slabs are shared between
 *  areas) and the photos of the slabs that have one, by slab id. */
export interface SolidsContext {
  allPieces: Piece[];
  photos: Record<string, SlabPhoto>;
  /** The shop's edge types, to know which finish each painted side has. */
  edgeTypes?: EdgeType[];
}

const EMPTY_BOUNDS: SolidsBounds = { centerX: 0, centerY: 0, sizeMm: COUNTER_HEIGHT_MM };

function pieceSolid(piece: Piece, context: SolidsContext | undefined): PieceSolid | null {
  const { points: local, sideOf } = sampleSides(piece);
  if (local.length < MIN_OUTLINE_POINTS || !isSimplePolygon(local)) return null;
  const toWorld = (points: Point[]) => transformOutline(points, piece.position, piece.rotationDeg);
  const openings = piece.cutouts
    .map((cutout) => ({ type: cutout.type, outline: cutoutOutline(cutout) }))
    .filter(({ outline }) => outline.length >= MIN_OUTLINE_POINTS && outline.every((p) => pointInPolygon(p, local)));
  const holes = openings.map(({ outline }) => toWorld(outline));
  const bowls = openings.filter(({ type }) => type === 'sink').map(({ outline }) => toWorld(outline));
  const finishes = sideOf.map((side): EdgeFinish => {
    const typeId = edgeAt(piece.edges, side).edgeTypeId;
    return (typeId && context?.edgeTypes?.find((t) => t.id === typeId)?.finish) || 'none';
  });
  const seams = piece.seams
    .flatMap((seam) => clipSegmentToPolygon(seam.from, seam.to, local))
    .map(([a, b]): Segment => {
      const [wa, wb] = toWorld([a, b]);
      return [wa, wb];
    });
  const thicknessMm = piece.thicknessMm > 0 ? piece.thicknessMm : DEFAULT_PIECE_THICKNESS_MM;
  const { texture, status } = context
    ? resolveTexture(piece, context.allPieces, context.photos)
    : { texture: null, status: 'none' as const };
  return {
    id: piece.id,
    label: piece.label,
    outline: toWorld(local),
    holes,
    thicknessMm,
    baseMm: COUNTER_HEIGHT_MM - thicknessMm,
    panels: buildPanels(piece, thicknessMm),
    segmentFinishes: finishes.some(shapesEdge) ? finishes : null,
    bowls,
    seams,
    texture,
    slabPhoto: status,
  };
}

function cabinetSolids(area: DrawingArea, pieces: PieceSolid[]): CabinetSolid[] {
  // Tucked under the thickest slab, so no cabinet pokes through a counter.
  const topMm = COUNTER_HEIGHT_MM - Math.max(DEFAULT_PIECE_THICKNESS_MM, ...pieces.map((p) => p.thicknessMm));
  return area.cabinets
    .filter((outline) => outline.length >= MIN_OUTLINE_POINTS && isSimplePolygon(outline))
    .map((outline, i) => ({ id: `${area.id}:cabinet:${i}`, outline, heightMm: topMm }));
}

export function buildAreaSolids(area: DrawingArea | undefined, context?: SolidsContext): AreaSolids {
  const built = (area?.pieces ?? []).map((piece) => pieceSolid(piece, context));
  const pieces = built.filter((p): p is PieceSolid => p !== null);
  const cabinets = area ? cabinetSolids(area, pieces) : [];
  if (pieces.length === 0) return { pieces, cabinets, skipped: built.length, bounds: EMPTY_BOUNDS };
  const box = bounds(pieces.flatMap((p) => p.outline));
  return {
    pieces,
    cabinets,
    skipped: built.length - pieces.length,
    bounds: {
      centerX: (box.minX + box.maxX) / 2,
      centerY: (box.minY + box.maxY) / 2,
      sizeMm: Math.max(box.maxX - box.minX, box.maxY - box.minY, 1),
    },
  };
}
