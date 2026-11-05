// Outline edits that keep a piece's data consistent: setting an exact edge
// length, adding and removing corners, and carrying per-edge settings
// (PieceEdge, which is keyed by edge *index*) across those edits so they stay
// on the right side of the piece. Pure — the caller validates the result.

import type { PieceEdge, Point } from '@/types/drawing';
import { distance } from './geometry';

/** How close to square (cosine of the angle between two sides) two sides must
 *  be for the length change to carry round the corner with them. */
const SQUARE_TOLERANCE = 1e-6;

/** Outline after setting edge `edgeIndex` (corner i -> corner i+1) to exactly
 *  `lengthMm`. The edge's far corner moves along the edge. When the next side
 *  meets it at a right angle (every rectangle, L and U) that side moves with
 *  it so it keeps its own length, and the side after it absorbs the change —
 *  the shape stays square instead of skewing. Returns null for a zero-length
 *  edge, which has no direction to extend along. */
export function setEdgeLength(outline: Point[], edgeIndex: number, lengthMm: number): Point[] | null {
  const n = outline.length;
  const from = outline[edgeIndex];
  const toIndex = (edgeIndex + 1) % n;
  const to = outline[toIndex];
  const current = distance(from, to);
  if (current === 0) return null;

  const dir = { x: (to.x - from.x) / current, y: (to.y - from.y) / current };
  const shift = { x: dir.x * (lengthMm - current), y: dir.y * (lengthMm - current) };

  const nextIndex = (edgeIndex + 2) % n;
  const next = outline[nextIndex];
  const nextLength = distance(to, next);
  const squareToNext = nextLength > 0
    && Math.abs(dir.x * (next.x - to.x) + dir.y * (next.y - to.y)) / nextLength < SQUARE_TOLERANCE;

  return outline.map((p, i) => {
    if (i === toIndex || (squareToNext && i === nextIndex && n > 3)) return { x: p.x + shift.x, y: p.y + shift.y };
    return p;
  });
}

/** Outline with corner `index` moved to `to`. */
export function moveVertex(outline: Point[], index: number, to: Point): Point[] {
  return outline.map((p, i) => (i === index ? to : p));
}

export interface OutlineWithEdges {
  outline: Point[];
  edges: PieceEdge[];
}

/** Adds a corner at the midpoint of edge `edgeIndex`, splitting it in two.
 *  Both halves inherit the original edge's settings. */
export function insertVertex({ outline, edges }: OutlineWithEdges, edgeIndex: number): OutlineWithEdges {
  const a = outline[edgeIndex];
  const b = outline[(edgeIndex + 1) % outline.length];
  const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  const nextOutline = [...outline.slice(0, edgeIndex + 1), mid, ...outline.slice(edgeIndex + 1)];

  const shifted = edges.map((e) => (e.index > edgeIndex ? { ...e, index: e.index + 1 } : e));
  const original = edges.find((e) => e.index === edgeIndex);
  return { outline: nextOutline, edges: original ? [...shifted, { ...original, index: edgeIndex + 1 }] : shifted };
}

/** Removes corner `vertexIndex`, joining the two sides that met there. The
 *  merged side keeps the settings of the one that came before the corner. */
export function removeVertex({ outline, edges }: OutlineWithEdges, vertexIndex: number): OutlineWithEdges {
  const n = outline.length;
  const nextOutline = outline.filter((_, i) => i !== vertexIndex);
  const nextEdges = edges
    .filter((e) => e.index !== vertexIndex)
    .map((e) => (e.index > vertexIndex ? { ...e, index: e.index - 1 } : e))
    // After the removal the merged edge sits at the old "previous" slot; the
    // wrap-around case (removing corner 0) lands on the new last index.
    .filter((e) => e.index < n - 1);
  return { outline: nextOutline, edges: nextEdges };
}
