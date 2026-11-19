// How an edge finish (ogee, bullnose, ...) cuts into the stone. The shop's finish artwork
// (edgeFinishProfiles.ts) is a side-on slice of the slab edge in a 96 x 96 box: the slab fills
// the left, spans y = 32 (top face) to y = 68 (underside), and the right-hand points trace the
// finished end. A square end reaches x = 88, so at any height the finish takes away
// (88 - x) units of stone, and 36 units is the whole slab thickness. Scaled to the real
// thickness, that is how far each side is pulled in at each height.

import type { EdgeFinish, Piece, Point } from '@/types/drawing';
import { arcHeightOf, arcPoints } from '../arcs';
import { outlineEdges } from '../geometry';
import { EDGE_FINISH_PROFILES } from '../edgeFinishProfiles';

/** The artwork's own geometry (see edgeFinishProfiles.ts). */
const PROFILE_TOP_Y = 32;
const PROFILE_BOTTOM_Y = 68;
const PROFILE_FLAT_X = 88;
const PROFILE_THICKNESS_UNITS = PROFILE_BOTTOM_Y - PROFILE_TOP_Y;

/** The finished end as (y, x) pairs from the top face down, without the two left-hand corners. */
const END_POINTS: Partial<Record<EdgeFinish, Array<[number, number]>>> = Object.fromEntries(
  Object.entries(EDGE_FINISH_PROFILES).map(([finish, points]) => {
    const all = points.split(' ').map((pair) => pair.split(',').map(Number));
    return [finish, all.slice(1, -1).map(([x, y]): [number, number] => [y, x])];
  }),
);

/** Whether a finish changes the shape of the edge at all. */
export const shapesEdge = (finish: EdgeFinish): boolean => finish !== 'none' && finish in END_POINTS;

/** How much of the slab's thickness the finish takes off the side, `t` of the way down (0 at
 *  the top face, 1 at the underside). 0 is a square edge. */
export function removalFraction(finish: EdgeFinish, t: number): number {
  const end = END_POINTS[finish];
  if (!end || end.length === 0) return 0;
  const y = PROFILE_TOP_Y + Math.min(1, Math.max(0, t)) * PROFILE_THICKNESS_UNITS;
  const next = end.findIndex(([py]) => py >= y);
  let x: number;
  if (next === -1) x = end[end.length - 1][1];
  else if (next === 0) x = end[0][1];
  else {
    const [y0, x0] = end[next - 1];
    const [y1, x1] = end[next];
    x = y1 === y0 ? x1 : x0 + ((x1 - x0) * (y - y0)) / (y1 - y0);
  }
  return Math.max(0, PROFILE_FLAT_X - x) / PROFILE_THICKNESS_UNITS;
}

export interface SampledOutline {
  points: Point[];
  /** For the segment from points[i] to points[i + 1]: the index of the piece's side it belongs to. */
  sideOf: number[];
}

/** The piece's outline with each curved side sampled, remembering which side every segment
 *  belongs to (a curved side is many segments). Same points as `outlinePolyline`. */
export function sampleSides(piece: Pick<Piece, 'outline' | 'edges'>): SampledOutline {
  const points: Point[] = [];
  const sideOf: number[] = [];
  outlineEdges(piece.outline).forEach(([from, to], side) => {
    const run = [from, ...arcPoints(from, to, arcHeightOf(piece.edges, side))];
    run.forEach((p) => {
      points.push(p);
      sideOf.push(side);
    });
  });
  return { points, sideOf };
}
