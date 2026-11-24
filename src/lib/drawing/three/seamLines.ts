// Seams are drawn by eye with their ends a little past the stone (the 2D board clips them
// to the outline). The 3D view does the same: only the parts of a seam that lie inside the
// piece's outline are kept, so no line floats off the edge of the stone.

import type { Point } from '@/types/drawing';
import { outlineEdges } from '../geometry';
import { pointInPolygon } from '../polygon';

export type Segment = [Point, Point];

/** Parallel (or nearly) sides never cross a seam at a single point. */
const PARALLEL_EPSILON = 1e-9;
/** Pieces of a seam shorter than this fraction of its length are noise. */
const MIN_PART_FRACTION = 1e-6;

const cross = (a: Point, b: Point): number => a.x * b.y - a.y * b.x;
const minus = (a: Point, b: Point): Point => ({ x: a.x - b.x, y: a.y - b.y });

/** Where along a->b (0..1, exclusive) it crosses the polygon's sides. */
function crossings(a: Point, b: Point, polygon: Point[]): number[] {
  const d = minus(b, a);
  return outlineEdges(polygon).flatMap(([q1, q2]) => {
    const e = minus(q2, q1);
    const denom = cross(d, e);
    if (Math.abs(denom) < PARALLEL_EPSILON) return [];
    const t = cross(minus(q1, a), e) / denom;
    const u = cross(minus(q1, a), d) / denom;
    return t > 0 && t < 1 && u >= 0 && u <= 1 ? [t] : [];
  });
}

/** The parts of the segment a->b that lie inside `polygon` (concave outlines can give several). */
export function clipSegmentToPolygon(a: Point, b: Point, polygon: Point[]): Segment[] {
  const stops = [0, ...crossings(a, b, polygon).sort((x, y) => x - y), 1];
  const at = (t: number): Point => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
  const parts: Segment[] = [];
  for (let i = 0; i < stops.length - 1; i += 1) {
    const [t0, t1] = [stops[i], stops[i + 1]];
    if (t1 - t0 > MIN_PART_FRACTION && pointInPolygon(at((t0 + t1) / 2), polygon)) parts.push([at(t0), at(t1)]);
  }
  return parts;
}
