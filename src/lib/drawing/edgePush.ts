// Pure math behind dragging one side of a piece with the Draw tool: the side
// slides along its own perpendicular and its two corners go with it, so the
// piece grows or shrinks in that direction while everything on the far side
// stays exactly where it was. For a rectangle that is "pull this side out".

import type { Point } from '@/types/drawing';
import { distance } from './geometry';

/** `value` rounded to the nearest multiple of `step`. */
export function snapToStep(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Unit vector perpendicular to side `edgeIndex` (corner i -> corner i+1), or
 *  null when the side has no length and therefore no direction. */
export function edgeNormal(outline: Point[], edgeIndex: number): Point | null {
  const from = outline[edgeIndex];
  const to = outline[(edgeIndex + 1) % outline.length];
  const length = distance(from, to);
  if (length === 0) return null;
  return { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
}

/** Outline after sliding side `edgeIndex` by `offsetMm` along its normal. The
 *  sign follows `edgeNormal`, so a caller projecting a pointer movement onto
 *  that same vector always moves the side towards the pointer. */
export function pushEdge(outline: Point[], edgeIndex: number, offsetMm: number): Point[] {
  const normal = edgeNormal(outline, edgeIndex);
  if (!normal) return outline;
  const toIndex = (edgeIndex + 1) % outline.length;
  return outline.map((p, i) => (
    i === edgeIndex || i === toIndex
      ? { x: p.x + normal.x * offsetMm, y: p.y + normal.y * offsetMm }
      : p
  ));
}
