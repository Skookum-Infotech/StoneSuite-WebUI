// The distance lines the Cutout dialog asks for: from a cutout out to the
// piece's edge, along one axis, measured from the cutout's centre or from its
// border. All in the piece's local coordinates (y up, like Piece.outline).

import type { Cutout, DistanceLineMode, DistanceLines, Piece, Point } from '@/types/drawing';
import { cutoutOutline } from './cutouts';
import { bounds } from './geometry';

export type DistanceSide = keyof DistanceLines;

export interface CutoutDistance {
  side: DistanceSide;
  from: Point;
  to: Point;
  lengthMm: number;
}

const DIRECTION: Record<DistanceSide, Point> = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  top: { x: 0, y: 1 },
  bottom: { x: 0, y: -1 },
};

const SIDES = Object.keys(DIRECTION) as DistanceSide[];
const EPSILON = 1e-6;

const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;

/** How far a ray from `origin` along `direction` travels before it meets the
 *  outline, or null when it never does. */
function distanceToOutline(outline: Point[], origin: Point, direction: Point): number | null {
  let nearest: number | null = null;
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length];
    const edge = { x: b.x - a.x, y: b.y - a.y };
    const denominator = cross(direction, edge);
    if (Math.abs(denominator) < EPSILON) return; // running along the edge
    const toStart = { x: a.x - origin.x, y: a.y - origin.y };
    const along = cross(toStart, edge) / denominator;
    const across = cross(toStart, direction) / denominator;
    if (along > EPSILON && across >= -EPSILON && across <= 1 + EPSILON && (nearest === null || along < nearest)) {
      nearest = along;
    }
  });
  return nearest;
}

/** Where a line for `side` starts: the cutout's centre, or the middle of its
 *  border on that side. */
function startPoint(cutout: Cutout, side: DistanceSide, mode: DistanceLineMode): Point {
  if (mode === 'center') return cutout.center;
  const b = bounds(cutoutOutline(cutout));
  switch (side) {
    case 'left': return { x: b.minX, y: cutout.center.y };
    case 'right': return { x: b.maxX, y: cutout.center.y };
    case 'top': return { x: cutout.center.x, y: b.maxY };
    default: return { x: cutout.center.x, y: b.minY };
  }
}

/** The distance lines `cutout` asks for, one per side that is not hidden and
 *  has piece edge to measure to. */
export function cutoutDistances(piece: Pick<Piece, 'outline'>, cutout: Cutout): CutoutDistance[] {
  const { distanceLines } = cutout;
  if (!distanceLines || cutoutOutline(cutout).length < 3) return [];
  return SIDES.flatMap((side) => {
    const mode = distanceLines[side];
    if (mode === 'hidden') return [];
    const from = startPoint(cutout, side, mode);
    const direction = DIRECTION[side];
    const lengthMm = distanceToOutline(piece.outline, from, direction);
    if (lengthMm === null) return [];
    return [{ side, from, to: { x: from.x + direction.x * lengthMm, y: from.y + direction.y * lengthMm }, lengthMm }];
  });
}
