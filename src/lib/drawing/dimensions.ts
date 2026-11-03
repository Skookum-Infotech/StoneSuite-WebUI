// Auto-placed edge dimension lines for the canvas (build spec Task 3: "on
// every outer edge, auto-placed outside the piece"). This is a different
// representation from dxfDimensionBlock.ts's DXF export geometry (lines +
// arrowhead SOLIDs + MTEXT) — this one is the simpler line+text layout the
// canvas renders live as a piece moves.

import type { Point } from '@/types/drawing';
import { outlineEdges } from './geometry';
import { DEFAULT_DIMENSION_OFFSET_MM } from './constants';

export interface DimensionLineLayout {
  edgeFrom: Point;
  edgeTo: Point;
  lineFrom: Point;
  lineTo: Point;
  textAt: Point;
  /** 0 or 90 for any axis-aligned edge — normalized so the text is never
   *  upside-down. */
  rotationDeg: number;
  lengthMm: number;
}

/** One dimension line per outer edge of `outline`, offset `offsetMm`
 *  outward from it. "Outward" is the same "left of travel direction"
 *  convention `dxfDimensionBlock.ts` uses for a clockwise outline — not
 *  reinvented here. */
export function layoutEdgeDimensions(
  outline: Point[],
  offsetMm: number = DEFAULT_DIMENSION_OFFSET_MM,
): DimensionLineLayout[] {
  return outlineEdges(outline)
    // A duplicate point gives a zero-length edge — nothing to dimension,
    // and dividing by its length below would give NaN.
    .filter(([from, to]) => from.x !== to.x || from.y !== to.y)
    .map(([from, to]) => {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const lengthMm = Math.hypot(dx, dy);
      const direction = { x: dx / lengthMm, y: dy / lengthMm };
      const outward = { x: -direction.y, y: direction.x };

      const lineFrom = { x: from.x + outward.x * offsetMm, y: from.y + outward.y * offsetMm };
      const lineTo = { x: to.x + outward.x * offsetMm, y: to.y + outward.y * offsetMm };
      const textAt = { x: (lineFrom.x + lineTo.x) / 2, y: (lineFrom.y + lineTo.y) / 2 };

      const angle = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      const rotationDeg = angle > 90 && angle <= 270 ? angle - 180 : angle;

      return { edgeFrom: from, edgeTo: to, lineFrom, lineTo, textAt, rotationDeg, lengthMm };
    });
}
