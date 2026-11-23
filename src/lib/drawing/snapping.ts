// Edge/corner snapping for dragged pieces. Works on world-space outlines.

import type { Point } from '@/types/drawing';

/** The nudge (add it to the moving piece's position) that lines the moving
 *  outline's corners up with the nearest corner-aligned vertical and
 *  horizontal lines of the other outlines, when one is within `toleranceMm`.
 *  X and Y are independent, so a piece can slide along one neighbour's edge
 *  while snapping flush against another. Zero on an axis with nothing close. */
export function snapNudge(moving: Point[], others: Point[][], toleranceMm: number): Point {
  let dx = 0;
  let dy = 0;
  let bestX = toleranceMm;
  let bestY = toleranceMm;
  for (const other of others) {
    for (const target of other) {
      for (const p of moving) {
        const ox = target.x - p.x;
        const oy = target.y - p.y;
        if (Math.abs(ox) <= bestX) {
          bestX = Math.abs(ox);
          dx = ox;
        }
        if (Math.abs(oy) <= bestY) {
          bestY = Math.abs(oy);
          dy = oy;
        }
      }
    }
  }
  return { x: dx, y: dy };
}
