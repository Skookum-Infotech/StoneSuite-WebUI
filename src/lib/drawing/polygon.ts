// Pure 2D polygon predicates used by validation, cutout placement and
// snapping. Works in whatever unit its inputs are in (millimetres, here) and
// knows nothing about pieces, SVG or the editor.

import type { Point } from '@/types/drawing';
import { distance, outlineEdges } from './geometry';

type Segment = [Point, Point];

function cross(o: Point, a: Point, b: Point): number {
  return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
}

function onSegment(p: Point, a: Point, b: Point): boolean {
  return Math.min(a.x, b.x) <= p.x && p.x <= Math.max(a.x, b.x)
    && Math.min(a.y, b.y) <= p.y && p.y <= Math.max(a.y, b.y);
}

/** True when the two closed segments share at least one point (crossing,
 *  touching an endpoint, or overlapping collinearly). */
export function segmentsIntersect([a, b]: Segment, [c, d]: Segment): boolean {
  const d1 = cross(c, d, a);
  const d2 = cross(c, d, b);
  const d3 = cross(a, b, c);
  const d4 = cross(a, b, d);
  if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return true;
  if (d1 === 0 && onSegment(a, c, d)) return true;
  if (d2 === 0 && onSegment(b, c, d)) return true;
  if (d3 === 0 && onSegment(c, a, b)) return true;
  if (d4 === 0 && onSegment(d, a, b)) return true;
  return false;
}

/** Shortest distance from `p` to the closed segment a-b. */
export function distanceToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSq = dx * dx + dy * dy;
  if (lengthSq === 0) return distance(p, a);
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSq));
  return distance(p, { x: a.x + t * dx, y: a.y + t * dy });
}

/** Ray-casting point-in-polygon. A point exactly on the boundary may land on
 *  either side — callers that care use a clearance distance instead. */
export function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i];
    const b = polygon[j];
    if ((a.y > p.y) !== (b.y > p.y) && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** True when no two non-adjacent edges of the closed polygon touch, and
 *  adjacent edges only meet at their shared vertex — i.e. it does not cross
 *  itself. */
export function isSimplePolygon(polygon: Point[]): boolean {
  const edges = outlineEdges(polygon);
  const n = edges.length;
  for (let i = 0; i < n; i += 1) {
    for (let j = i + 1; j < n; j += 1) {
      const adjacent = j === i + 1 || (i === 0 && j === n - 1);
      if (adjacent) {
        // Adjacent edges a->b, b->c may share only b: reject a fold-back
        // where the second edge doubles back over the first.
        const [a, b, c] = j === i + 1
          ? [edges[i][0], edges[i][1], edges[j][1]]
          : [edges[j][0], edges[j][1], edges[i][1]];
        const foldsBack = cross(a, b, c) === 0 && (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y) < 0;
        if (foldsBack) return false;
        continue;
      }
      if (segmentsIntersect(edges[i], edges[j])) return false;
    }
  }
  return true;
}

/** Smallest distance between the boundaries of two polygons. Only meaningful
 *  when the polygons do not cross — callers check overlap first. */
export function boundaryDistance(a: Point[], b: Point[]): number {
  let best = Infinity;
  for (const p of a) for (const [c, d] of outlineEdges(b)) best = Math.min(best, distanceToSegment(p, c, d));
  for (const p of b) for (const [c, d] of outlineEdges(a)) best = Math.min(best, distanceToSegment(p, c, d));
  return best;
}

/** True when any edge of `a` crosses or touches any edge of `b`. */
export function boundariesIntersect(a: Point[], b: Point[]): boolean {
  const bEdges = outlineEdges(b);
  return outlineEdges(a).some((edge) => bEdges.some((other) => segmentsIntersect(edge, other)));
}

/** True when the two polygons share any area or touch: boundaries meet, or
 *  one lies entirely inside the other. */
export function polygonsOverlap(a: Point[], b: Point[]): boolean {
  if (boundariesIntersect(a, b)) return true;
  return pointInPolygon(a[0], b) || pointInPolygon(b[0], a);
}

/** True when `inner` lies wholly inside `outer`, keeping at least
 *  `clearanceMm` of material between their boundaries. */
export function polygonInside(inner: Point[], outer: Point[], clearanceMm: number): boolean {
  if (boundariesIntersect(inner, outer)) return false;
  if (!inner.every((p) => pointInPolygon(p, outer))) return false;
  return boundaryDistance(inner, outer) >= clearanceMm;
}

/** Interior angle at each vertex, in degrees, for a clockwise outline (the
 *  app-wide convention). A reflex corner (e.g. an L's inside corner) reads as
 *  270, a square corner as 90. */
export function interiorAngles(outline: Point[]): number[] {
  const n = outline.length;
  return outline.map((current, i) => {
    const prev = outline[(i + n - 1) % n];
    const next = outline[(i + 1) % n];
    const toPrev = Math.atan2(prev.y - current.y, prev.x - current.x);
    const toNext = Math.atan2(next.y - current.y, next.x - current.x);
    // Clockwise winding: the interior lies clockwise from the outgoing edge
    // round to the edge arriving from the previous corner.
    const sweep = ((toNext - toPrev) * 180) / Math.PI;
    return ((sweep % 360) + 360) % 360;
  });
}
