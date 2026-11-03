// Pure outline/shape math for pieces. Everything here works in whatever
// unit its millimetre inputs are in and knows nothing about DXF or SVG —
// both the canvas and the exporter build on these.

import type { Point } from '@/types/drawing';

/** Clockwise outline of a rectangle, `lengthMm` wide (+X) by `widthMm` deep
 *  (-Y), with the first point at the origin. */
export function rectOutline(lengthMm: number, widthMm: number): Point[] {
  return [
    { x: 0, y: 0 },
    { x: lengthMm, y: 0 },
    { x: lengthMm, y: -widthMm },
    { x: 0, y: -widthMm },
  ];
}

/** The outline's edges, each as its two endpoints in winding order — the
 *  last edge closes back to the first point. One dimension line is drawn
 *  per edge (build spec §5 Task 3). */
export function outlineEdges(outline: Point[]): Array<[Point, Point]> {
  return outline.map((point, i) => [point, outline[(i + 1) % outline.length]] as [Point, Point]);
}

function distance(a: Point, b: Point): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Sum of every edge length. */
export function perimeter(outline: Point[]): number {
  return outlineEdges(outline).reduce((sum, [a, b]) => sum + distance(a, b), 0);
}

/** The raw (signed) shoelace sum — negative for the clockwise winding
 *  every other piece of outline math in this app assumes (`rectOutline`,
 *  `dxfDimensionBlock.ts`'s "left of travel = outward" rule, and this
 *  file's own `transformOutline`), positive for the reverse. */
function signedArea(outline: Point[]): number {
  let sum = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i];
    const b = outline[(i + 1) % outline.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return sum;
}

/** Shoelace-formula area. Always non-negative, regardless of winding
 *  direction, so a piece authored counter-clockwise doesn't read as
 *  negative square footage. */
export function area(outline: Point[]): number {
  return Math.abs(signedArea(outline)) / 2;
}

/** True when `outline` winds the same direction as `rectOutline`'s own
 *  corners. A hand-clicked polygon (Task 3's polygon tool) can go either
 *  way depending on click order; callers that assume this winding
 *  (dimension layout, DXF export) need to normalize it first. */
export function isClockwise(outline: Point[]): boolean {
  return signedArea(outline) < 0;
}

const MM2_PER_FT2 = 92903.04;

/** Area converted to square feet, for the editor's footer summary. */
export function squareFeet(outline: Point[]): number {
  return area(outline) / MM2_PER_FT2;
}

/** Axis-aligned bounding box of an outline. */
export function bounds(outline: Point[]): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = outline.map((p) => p.x);
  const ys = outline.map((p) => p.y);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Clockwise outline of an L-shaped piece: a `lengthMm` x `widthMm`
 *  bounding box with a `notchLengthMm` x `notchWidthMm` notch removed from
 *  the top-right corner. */
export function lShapeOutline(
  lengthMm: number, widthMm: number, notchLengthMm: number, notchWidthMm: number,
): Point[] {
  return [
    { x: 0, y: 0 },
    { x: lengthMm - notchLengthMm, y: 0 },
    { x: lengthMm - notchLengthMm, y: -notchWidthMm },
    { x: lengthMm, y: -notchWidthMm },
    { x: lengthMm, y: -widthMm },
    { x: 0, y: -widthMm },
  ];
}

/** Clockwise outline of a U-shaped piece: a `lengthMm` x `widthMm`
 *  bounding box with a `notchLengthMm`-wide, `notchDepthMm`-deep notch
 *  removed from the center of the top edge. */
export function uShapeOutline(
  lengthMm: number, widthMm: number, notchLengthMm: number, notchDepthMm: number,
): Point[] {
  const notchStart = (lengthMm - notchLengthMm) / 2;
  const notchEnd = (lengthMm + notchLengthMm) / 2;
  return [
    { x: 0, y: 0 },
    { x: notchStart, y: 0 },
    { x: notchStart, y: -notchDepthMm },
    { x: notchEnd, y: -notchDepthMm },
    { x: notchEnd, y: 0 },
    { x: lengthMm, y: 0 },
    { x: lengthMm, y: -widthMm },
    { x: 0, y: -widthMm },
  ];
}

/** Rounds a point to the nearest multiple of `gridSizeMm` on both axes. */
export function snapToGrid(point: Point, gridSizeMm: number): Point {
  return {
    x: Math.round(point.x / gridSizeMm) * gridSizeMm,
    y: Math.round(point.y / gridSizeMm) * gridSizeMm,
  };
}

/** Converts a piece's local outline into world/drawing coordinates: rotate
 *  clockwise about the origin by `rotationDeg` (screen/DXF convention,
 *  y-up), then translate by `position`. A piece's `outline` field never
 *  changes on move/rotate — only `position`/`rotationDeg` do — so this is
 *  always how a piece's rendered or exported shape is derived. */
export function transformOutline(outline: Point[], position: Point, rotationDeg: 0 | 90 | 180 | 270): Point[] {
  const rotate = (p: Point): Point => {
    switch (rotationDeg) {
      case 0: return { x: p.x, y: p.y };
      case 90: return { x: p.y, y: -p.x };
      case 180: return { x: -p.x, y: -p.y };
      case 270: return { x: -p.y, y: p.x };
    }
  };
  return outline.map((p) => {
    const r = rotate(p);
    return { x: r.x + position.x, y: r.y + position.y };
  });
}
