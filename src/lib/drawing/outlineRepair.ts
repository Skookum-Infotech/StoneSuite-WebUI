// What a side drag produced, put right when the drag carried a side across
// others. Dragging a side past the opposite side flips the box (wound the
// wrong way round); carrying one over another side draws a loop whose sides
// cross. A person does both on purpose, so rather than refusing them the
// outline is re-wound clockwise and — for the square-cornered shapes the Draw
// tool makes — the crossing sides are merged into the one outline of the area
// they cover, so the piece shows as the shape it now is, not as overlapping
// lines.

import type { Point } from '@/types/drawing';
import { isClockwise } from './geometry';
import { isSimplePolygon } from './polygon';

const AXIS_TOLERANCE_MM = 1e-6;

const isSquareCornered = (outline: Point[]): boolean => outline.every((p, i) => {
  const q = outline[(i + 1) % outline.length];
  return Math.abs(p.x - q.x) < AXIS_TOLERANCE_MM || Math.abs(p.y - q.y) < AXIS_TOLERANCE_MM;
});

const sortedUnique = (values: number[]): number[] => Array.from(new Set(values)).sort((a, b) => a - b);

/** Winding number of a square-cornered `outline` around (x, y): the signed
 *  vertical sides to the point's right. */
function windingAt(outline: Point[], x: number, y: number): number {
  let winding = 0;
  outline.forEach((a, i) => {
    const b = outline[(i + 1) % outline.length];
    if (Math.abs(a.x - b.x) >= AXIS_TOLERANCE_MM || a.x <= x) return;
    if (y > Math.min(a.y, b.y) && y < Math.max(a.y, b.y)) winding += b.y > a.y ? 1 : -1;
  });
  return winding;
}

/** The single clockwise outline round the cells `filled` says are solid (cell
 *  (i, j) spans xs[i]..xs[i+1] by ys[j]..ys[j+1]) — or null when they are not
 *  one solid shape: there is a hole, or parts that only touch at a corner. */
function traceRegion(xs: number[], ys: number[], filled: (i: number, j: number) => boolean): Point[] | null {
  // Every cell side with nothing filled beyond it, directed so the cell is on
  // its right: clockwise around the area, as the rest of the app wants.
  const next = new Map<string, [number, number]>();
  let total = 0;
  const link = (from: [number, number], to: [number, number]) => {
    next.set(`${from[0]},${from[1]}`, to);
    total += 1;
  };
  for (let i = 0; i < xs.length - 1; i += 1) {
    for (let j = 0; j < ys.length - 1; j += 1) {
      if (!filled(i, j)) continue;
      if (!filled(i, j + 1)) link([i, j + 1], [i + 1, j + 1]);
      if (!filled(i + 1, j)) link([i + 1, j + 1], [i + 1, j]);
      if (!filled(i, j - 1)) link([i + 1, j], [i, j]);
      if (!filled(i - 1, j)) link([i, j], [i, j + 1]);
    }
  }
  // Two sides leaving one corner overwrite each other above: a pinch.
  if (total === 0 || next.size !== total) return null;

  const [first] = next.keys();
  const loop: Array<[number, number]> = [];
  let at = first.split(',').map(Number) as [number, number];
  for (let steps = 0; steps <= total; steps += 1) {
    loop.push(at);
    const to = next.get(`${at[0]},${at[1]}`);
    if (!to) return null;
    at = to;
    if (`${at[0]},${at[1]}` === first) break;
  }
  if (loop.length !== total) return null;

  const corners = loop.map(([i, j]) => ({ x: xs[i], y: ys[j] }));
  return corners.filter((p, k) => {
    const before = corners[(k - 1 + corners.length) % corners.length];
    const after = corners[(k + 1) % corners.length];
    return !((before.x === p.x && p.x === after.x) || (before.y === p.y && p.y === after.y));
  });
}

/** Does `outline` cover the cell centred on (x, y)? */
const covers = (outline: Point[], x: number, y: number): boolean => windingAt(outline, x, y) !== 0;

/** The area a square-cornered, self-crossing `outline` covers, as one outline. */
function mergeCrossing(outline: Point[]): Point[] | null {
  const xs = sortedUnique(outline.map((p) => p.x));
  const ys = sortedUnique(outline.map((p) => p.y));
  return traceRegion(xs, ys, (i, j) => (
    i >= 0 && j >= 0 && i < xs.length - 1 && j < ys.length - 1
    && covers(outline, (xs[i] + xs[i + 1]) / 2, (ys[j] + ys[j + 1]) / 2)
  ));
}

/** `outline` with the rectangle between corners `a` and `b` added to it
 *  (`mode` "add") or cut out of it ("cut"): what a side leaves behind when it
 *  is carried across the shape. Null when the result is not one solid shape,
 *  or the outline is not square-cornered. */
export function applyRect(outline: Point[], a: Point, b: Point, mode: 'add' | 'cut'): Point[] | null {
  if (!isSquareCornered(outline)) return null;
  const [x0, x1] = [Math.min(a.x, b.x), Math.max(a.x, b.x)];
  const [y0, y1] = [Math.min(a.y, b.y), Math.max(a.y, b.y)];
  const xs = sortedUnique([...outline.map((p) => p.x), x0, x1]);
  const ys = sortedUnique([...outline.map((p) => p.y), y0, y1]);
  return traceRegion(xs, ys, (i, j) => {
    if (i < 0 || j < 0 || i >= xs.length - 1 || j >= ys.length - 1) return false;
    const cx = (xs[i] + xs[i + 1]) / 2;
    const cy = (ys[j] + ys[j + 1]) / 2;
    const inRect = cx > x0 && cx < x1 && cy > y0 && cy < y1;
    return mode === 'add' ? inRect || covers(outline, cx, cy) : !inRect && covers(outline, cx, cy);
  });
}

/** `outline` wound clockwise, with sides that cross merged into the shape they
 *  cover where that is one solid shape; otherwise returned as it came, for
 *  validation to refuse. */
export function repairOutline(outline: Point[]): Point[] {
  if (outline.length < 3) return outline;
  if (!isSimplePolygon(outline)) {
    return (isSquareCornered(outline) ? mergeCrossing(outline) : null) ?? outline;
  }
  return isClockwise(outline) ? outline : [...outline].reverse();
}
