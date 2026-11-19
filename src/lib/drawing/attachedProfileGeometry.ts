// Turns a piece's painted-profile sides (PieceEdge.attachedProfile) into the
// unfolded rectangle the 2D board draws next to the parent piece — one per
// painted side, with its own label and dimensions — derived at render time
// from the side geometry and the resolved AttachedProfileType, never stored.
// Mirrors how PieceEdgeColors derives Edges' paint colour from edgeTypeId,
// one layer further: a whole second shape instead of a stroke colour.

import type { AttachedProfileType, Piece, Point } from '@/types/drawing';
import { paintedProfileSides } from './attachedProfileTypes';
import { ATTACHED_PROFILE_GAP_MM } from './constants';
import { distance, outlineEdges, transformOutline } from './geometry';
import { edgeLetter } from './labels';

export interface AttachedProfilePiece {
  /** The parent side's index, so clicking this rectangle can be routed back to it. */
  index: number;
  /** The unfolded rectangle, in world space: [near-start, near-end, far-end, far-start]. */
  outline: Point[];
  /** The parent piece's own border for this side, in world space — the
   *  "attached part" the near edge of `outline` sits a gap away from. Only
   *  this stretch of the parent's border is tinted, not the whole piece. */
  parentEdge: [Point, Point];
  label: string;
  lengthMm: number;
  widthMm: number;
  color: string;
  /** Whether the parent side's two ends sit at a corner whose other side also
   *  carries a mitered-finish profile — a visual cue only; the rectangle
   *  itself is never reshaped. */
  miteredStart: boolean;
  miteredEnd: boolean;
}

/** The painted side just before/after `index` around the outline, including
 *  wrap-around, so the first and last sides see each other as neighbours. */
function neighborIndex(total: number, index: number, delta: -1 | 1): number {
  return (index + delta + total) % total;
}

/** The unfolded rectangle for one painted side running `a` -> `b`: the near
 *  edge a gap outward from the side, the far edge `widthMm` beyond that.
 *  Shared by the on-canvas (world-space) and slab-placement (piece-local-
 *  space) callers below — the gap is a constant offset on all four corners,
 *  so it drops straight out once a caller normalizes the shape to its own
 *  bounding box (lib/drawing/slabs.ts's normalisedOutline). */
function unfoldedRectangle(a: Point, b: Point, lengthMm: number, widthMm: number): Point[] {
  // The outline is clockwise (y up); the piece lies to the right of each
  // side's direction of travel (see EdgeMarks), so "outward" is the left
  // normal: the mirror of that inward vector.
  const outward: Point = { x: -(b.y - a.y) / lengthMm, y: (b.x - a.x) / lengthMm };
  const near = (p: Point): Point => ({ x: p.x + outward.x * ATTACHED_PROFILE_GAP_MM, y: p.y + outward.y * ATTACHED_PROFILE_GAP_MM });
  const far = (p: Point): Point => ({
    x: p.x + outward.x * (ATTACHED_PROFILE_GAP_MM + widthMm), y: p.y + outward.y * (ATTACHED_PROFILE_GAP_MM + widthMm),
  });
  return [near(a), near(b), far(b), far(a)];
}

export function attachedProfilePieces(piece: Pick<Piece, 'id' | 'label' | 'outline' | 'position' | 'rotationDeg' | 'edges'>, types: AttachedProfileType[]): AttachedProfilePiece[] {
  const worldOutline = transformOutline(piece.outline, piece.position, piece.rotationDeg);
  const sides = outlineEdges(worldOutline);
  const painted = paintedProfileSides(piece.edges, types);
  const paintedByIndex = new Map(painted.map((p) => [p.index, p]));

  return painted.flatMap(({ index, type, measurementMm }) => {
    const side = sides[index];
    if (!side) return []; // stale entry for a side that no longer exists
    const [a, b] = side;
    const lengthMm = distance(a, b);
    if (lengthMm === 0) return [];
    const startNeighbor = paintedByIndex.get(neighborIndex(sides.length, index, -1));
    const endNeighbor = paintedByIndex.get(neighborIndex(sides.length, index, 1));
    return [{
      index,
      outline: unfoldedRectangle(a, b, lengthMm, measurementMm),
      parentEdge: [a, b],
      label: `${piece.label} ${type.name}-${edgeLetter(index)}`,
      lengthMm,
      widthMm: measurementMm,
      color: type.color,
      miteredStart: type.finish === 'mitered' && startNeighbor?.type.finish === 'mitered',
      miteredEnd: type.finish === 'mitered' && endNeighbor?.type.finish === 'mitered',
    }];
  });
}

/** The same rectangle `attachedProfilePieces` draws for one painted side, but
 *  in the PIECE's own local space — no `position`/`rotationDeg` applied —
 *  independent of where the piece currently sits on the board. This is what
 *  the Material tab lays on a slab (lib/drawing/slabPlaceables.ts): a slab
 *  placement, like `Piece.outline` itself, is unaffected by the piece's
 *  position on the board. Null when the side no longer exists or is
 *  degenerate (mirrors attachedProfilePieces' own per-side skip). */
export function attachedProfileLocalOutline(outline: Point[], edgeIndex: number, measurementMm: number): Point[] | null {
  const side = outlineEdges(outline)[edgeIndex];
  if (!side) return null;
  const [a, b] = side;
  const lengthMm = distance(a, b);
  if (lengthMm === 0) return null;
  return unfoldedRectangle(a, b, lengthMm, measurementMm);
}
