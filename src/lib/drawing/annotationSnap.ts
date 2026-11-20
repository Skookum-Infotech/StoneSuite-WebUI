// Where the Seams and Dimension tools put a point. A raw click rarely lands on
// the exact spot a seam or a measurement belongs, so the point is pulled to
// something real, in this order of preference:
//   1. a piece's corner;
//   2. straight across: the spot where a horizontal or vertical line (or one at
//      right angles to the side the line started on) from the first point meets a
//      border, so a seam can be run square across a top and end exactly on its far
//      side without the pointer being exact;
//   3. the nearest spot on any border;
// and left as clicked when none is close enough. Pure: pieces come in as world
// millimetres and the tolerance already allows for the zoom.

import type { DrawingArea, Point } from '@/types/drawing';
import { outlinePolyline } from './arcs';
import { distance, transformOutline } from './geometry';

export type SnapKind = 'corner' | 'across' | 'edge' | 'free';

export interface Snap {
  point: Point;
  kind: SnapKind;
  /** The border segment the point sits on, when it sits on one — a line started there can
   *  then be run at right angles to it. */
  side?: [Point, Point];
}

/** Where a pointer might snap: each piece's corners and its border (curved sides flattened). */
export interface SnapGeometry {
  corners: Point[];
  outlines: Point[][];
}

/** The line being drawn, once its first point is down. */
export interface SnapFrom {
  point: Point;
  side?: [Point, Point];
}

const EPSILON = 1e-6;

export function snapGeometry(area: Pick<DrawingArea, 'pieces'>): SnapGeometry {
  return {
    corners: area.pieces.flatMap((p) => transformOutline(p.outline, p.position, p.rotationDeg)),
    outlines: area.pieces.map((p) => transformOutline(outlinePolyline(p.outline, p.edges), p.position, p.rotationDeg)),
  };
}

function segmentsOf(outline: Point[]): Array<[Point, Point]> {
  return outline.map((p, i): [Point, Point] => [p, outline[(i + 1) % outline.length]]);
}

/** The closest point of segment a-b to `p`. */
function closestOnSegment(p: Point, a: Point, b: Point): Point {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return a;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared));
  return { x: a.x + t * dx, y: a.y + t * dy };
}

function nearestCorner(point: Point, corners: Point[], toleranceMm: number): Point | null {
  let best: Point | null = null;
  let bestDistance = toleranceMm;
  for (const corner of corners) {
    const d = distance(point, corner);
    if (d <= bestDistance) {
      best = corner;
      bestDistance = d;
    }
  }
  return best;
}

function nearestOnBorders(point: Point, outlines: Point[][], toleranceMm: number): { point: Point; side: [Point, Point] } | null {
  let best: { point: Point; side: [Point, Point] } | null = null;
  let bestDistance = toleranceMm;
  for (const outline of outlines) {
    for (const [a, b] of segmentsOf(outline)) {
      const spot = closestOnSegment(point, a, b);
      const d = distance(point, spot);
      if (d <= bestDistance) {
        best = { point: spot, side: [a, b] };
        bestDistance = d;
      }
    }
  }
  return best;
}

/** Where the ray from `origin` along unit `direction` meets segment a-b, ahead of the origin only. */
function rayMeetsSegment(origin: Point, direction: Point, a: Point, b: Point): Point | null {
  const ex = b.x - a.x;
  const ey = b.y - a.y;
  const denominator = direction.x * ey - direction.y * ex;
  if (Math.abs(denominator) < EPSILON) return null;
  const wx = a.x - origin.x;
  const wy = a.y - origin.y;
  const along = (wx * ey - wy * ex) / denominator;
  const across = (wx * direction.y - wy * direction.x) / denominator;
  if (along <= EPSILON || across < -EPSILON || across > 1 + EPSILON) return null;
  return { x: origin.x + direction.x * along, y: origin.y + direction.y * along };
}

/** The unit directions a line may be run "straight": along the axes, and — when it
 *  started on a border — at right angles to that border, both ways. */
function straightDirections(from: SnapFrom): Point[] {
  const axes: Point[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
  if (!from.side) return axes;
  const [a, b] = from.side;
  const length = distance(a, b);
  if (length === 0) return axes;
  const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
  return [...axes, normal, { x: -normal.x, y: -normal.y }];
}

function nearestAcross(cursor: Point, from: SnapFrom, outlines: Point[][], toleranceMm: number): Point | null {
  let best: Point | null = null;
  let bestDistance = toleranceMm;
  for (const direction of straightDirections(from)) {
    for (const outline of outlines) {
      for (const [a, b] of segmentsOf(outline)) {
        const meet = rayMeetsSegment(from.point, direction, a, b);
        if (!meet) continue;
        const d = distance(cursor, meet);
        if (d <= bestDistance) {
          best = meet;
          bestDistance = d;
        }
      }
    }
  }
  return best;
}

/** `cursor`, pulled to the best nearby corner, straight-across spot or border point within
 *  `toleranceMm`. `from` is the line's first point when this is its second. */
export function snapAnnotationPoint(cursor: Point, geometry: SnapGeometry, toleranceMm: number, from?: SnapFrom): Snap {
  const corner = nearestCorner(cursor, geometry.corners, toleranceMm);
  if (corner) {
    // A corner is also on a border; remember which, so a line from it can run square to that side.
    const side = nearestOnBorders(corner, geometry.outlines, EPSILON)?.side;
    return { point: corner, kind: 'corner', side };
  }
  if (from) {
    const across = nearestAcross(cursor, from, geometry.outlines, toleranceMm);
    if (across) return { point: across, kind: 'across', side: nearestOnBorders(across, geometry.outlines, EPSILON)?.side };
  }
  const edge = nearestOnBorders(cursor, geometry.outlines, toleranceMm);
  if (edge) return { point: edge.point, kind: 'edge', side: edge.side };
  return { point: cursor, kind: 'free' };
}
