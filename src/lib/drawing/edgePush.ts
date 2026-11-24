// Pure math behind dragging one side of a piece with the Draw tool.
//
// Dragged the way the side faces (in/out), the side slides along its own
// perpendicular and its two corners go with it, so the piece grows or shrinks
// in that direction while everything on the far side stays where it was.
//
// Dragged along its own length instead (a vertical side pulled down, a
// horizontal one pulled sideways), a return leg grows off that end of the
// side: a countertop-deep strip, measured in from the dragged side, running
// as far past the corner as the pointer went. That is how an L-shaped run is
// drawn — the C5 shape: a run with its right side pulled out, then down.

import type { Point } from '@/types/drawing';
import { MIN_LEG_REMAINDER_MM } from './constants';
import { distance } from './geometry';
import { applyRect, repairOutline } from './outlineRepair';
import { isSimplePolygon } from './polygon';

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

/** A dragged side's new outline, plus the one border now being pulled — the
 *  side itself while resizing, the leg's far end once a leg grows — for the
 *  canvas to highlight. */
export interface SideDrag {
  outline: Point[];
  moved: Point[];
  /** Index (in `outline`) of the side a leg just grew, if one did — the side
   *  a second leg can grow off, for a staircase. */
  legEnd?: number;
  /** Two opposite corners of the leg just grown: what is added to the shape
   *  if the leg's own outline would cross it. */
  legRect?: [Point, Point];
}

/** Square corners only: the side running off a corner has to point straight
 *  inward for a leg to sit flush against it. */
const PERPENDICULAR_TOLERANCE = 1e-6;

const add = (p: Point, v: Point, k: number): Point => ({ x: p.x + v.x * k, y: p.y + v.y * k });

/** Outline after growing a `widthMm`-wide leg off one end of side `edgeIndex`,
 *  `alongMm` past it: positive past corner i+1, negative past corner i. When
 *  the side running inward off that corner is barely longer than the leg is
 *  wide (a square only one countertop deep), the leg would leave a sliver
 *  beside it — so that side is simply pushed out instead, lengthening the
 *  piece. A corner that isn't square is left alone. */
export function growLeg(outline: Point[], edgeIndex: number, alongMm: number, widthMm: number): SideDrag {
  const n = outline.length;
  const ia = edgeIndex;
  const ib = (edgeIndex + 1) % n;
  const a = outline[ia];
  const b = outline[ib];
  const normal = edgeNormal(outline, edgeIndex);
  const unchanged = { outline, moved: [a, b] };
  if (!normal || alongMm === 0) return unchanged;

  const tangent = { x: normal.y, y: -normal.x };
  const atEnd = alongMm > 0;
  const corner = atEnd ? b : a;
  const neighbourEdge = atEnd ? ib : (ia - 1 + n) % n;
  const neighbour = atEnd ? outline[(ib + 1) % n] : outline[neighbourEdge];
  const neighbourLength = distance(corner, neighbour);
  if (neighbourLength === 0) return unchanged;
  const inwardness = -((neighbour.x - corner.x) * normal.x + (neighbour.y - corner.y) * normal.y) / neighbourLength;
  if (inwardness < 1 - PERPENDICULAR_TOLERANCE) return unchanged;

  const reach = Math.abs(alongMm);
  if (neighbourLength < widthMm + MIN_LEG_REMAINDER_MM) {
    const next = pushEdge(outline, neighbourEdge, reach);
    return { outline: next, moved: [next[neighbourEdge], next[(neighbourEdge + 1) % n]] };
  }

  const tip = add(corner, tangent, atEnd ? reach : -reach);
  const tipIn = add(tip, normal, -widthMm);
  const baseIn = add(corner, normal, -widthMm);
  const chain = atEnd ? [tip, tipIn, baseIn] : [baseIn, tipIn, tip];
  const replaced = atEnd ? ib : ia;
  const next = outline.flatMap((p, i) => (i === replaced ? chain : [p]));
  return { outline: next, moved: atEnd ? [tip, tipIn] : [tipIn, tip], legEnd: atEnd ? replaced : replaced + 1, legRect: [tip, baseIn] };
}

/** A pointer movement (local mm) split into how far it went across side
 *  `edgeIndex` (along its normal) and along it (corner i -> corner i+1), or
 *  null for a side with no length. */
export function sideDragComponents(outline: Point[], edgeIndex: number, delta: Point): { across: number; along: number } | null {
  const normal = edgeNormal(outline, edgeIndex);
  if (!normal) return null;
  return {
    across: delta.x * normal.x + delta.y * normal.y,
    along: delta.x * normal.y - delta.y * normal.x,
  };
}

/** How close two points, or a point and a line, must be to count as one. */
const JOIN_EPSILON_MM = 0.01;

/** `acrossMm` — how far side `edgeIndex` is to be pushed — pulled onto the
 *  line of a parallel side two along (the other side of the step it forms)
 *  when it lands within `toleranceMm` of it, so a side brought back to where
 *  it joins that line lands exactly on it. */
export function snapAcrossToJoin(outline: Point[], edgeIndex: number, acrossMm: number, toleranceMm: number): number {
  const normal = edgeNormal(outline, edgeIndex);
  const n = outline.length;
  // A four-sided piece's only parallel side is its opposite one: "joining"
  // that would flatten the piece, not tidy a step.
  if (!normal || n < 5) return acrossMm;
  const base = outline[edgeIndex];
  let best = acrossMm;
  let bestGap = toleranceMm;
  for (const step of [-2, 2]) {
    const j = (edgeIndex + step + n) % n;
    const a = outline[j];
    const b = outline[(j + 1) % n];
    const length = distance(a, b);
    if (length === 0) continue;
    const parallel = Math.abs(((b.x - a.x) * normal.x + (b.y - a.y) * normal.y) / length) < PERPENDICULAR_TOLERANCE;
    const target = (a.x - base.x) * normal.x + (a.y - base.y) * normal.y;
    if (parallel && Math.abs(acrossMm - target) <= bestGap) {
      best = target;
      bestGap = Math.abs(acrossMm - target);
    }
  }
  return best;
}

/** `next` with the corners a drag touched (`moved`) tidied: two corners on
 *  top of each other become one, and a corner sitting on the straight line
 *  between its neighbours is dropped — so a side brought back onto its
 *  neighbour's line becomes one clean side. Corners the drag did not touch (a
 *  split point added on purpose, say) are never removed. */
export function joinOutline(next: Point[], moved: Point[]): Point[] {
  const sameAs = (p: Point) => (q: Point) => distance(p, q) < JOIN_EPSILON_MM;
  let items = next.map((p) => ({ p, touched: moved.some(sameAs(p)) }));
  for (let changed = true; changed && items.length > 3;) {
    changed = false;
    const n = items.length;
    const twin = items.findIndex((it, i) => distance(it.p, items[(i + 1) % n].p) < JOIN_EPSILON_MM);
    if (twin >= 0) {
      const other = (twin + 1) % n;
      items = items.flatMap((it, i) => {
        if (i === twin) return [{ p: it.p, touched: it.touched || items[other].touched }];
        return i === other ? [] : [it];
      });
      changed = true;
      continue;
    }
    const straight = items.findIndex((it, i) => {
      if (!it.touched) return false;
      const a = items[(i - 1 + n) % n].p;
      const c = items[(i + 1) % n].p;
      const span = distance(a, c);
      if (span < JOIN_EPSILON_MM) return true;
      return Math.abs((c.x - a.x) * (it.p.y - a.y) - (c.y - a.y) * (it.p.x - a.x)) / span < JOIN_EPSILON_MM;
    });
    if (straight >= 0) {
      items = items.filter((_, i) => i !== straight);
      changed = true;
    }
  }
  return items.map((it) => it.p);
}

/** The pointer's whole movement, for turning a second time: right, then up,
 *  then right again is a staircase, each turn a fresh leg. */
export interface Stairs {
  /** The pointer's movement from where the drag began (local mm). */
  delta: Point;
  /** Wobble this small after a turn is ignored. */
  deadMm: number;
  stepMm: number;
}

/** A second leg off the end of the one `first` just grew, the way the pointer
 *  has gone since: along the dragged side's own normal, past where that side
 *  was left (`acrossMm`). Null when it has not gone far enough to count. */
function growSecondLeg(
  first: SideDrag, normal: Point, acrossMm: number, legWidthMm: number, stairs: Stairs,
): SideDrag | null {
  if (first.legEnd === undefined) return null;
  const legNormal = edgeNormal(first.outline, first.legEnd);
  if (!legNormal) return null;
  // The leg's end runs along (or against) the dragged side's normal.
  const tangent = { x: legNormal.y, y: -legNormal.x };
  const heading = tangent.x * normal.x + tangent.y * normal.y;
  const raw = tangent.x * stairs.delta.x + tangent.y * stairs.delta.y - heading * acrossMm;
  if (Math.abs(raw) <= stairs.deadMm) return null;
  const reach = snapToStep(raw - Math.sign(raw) * stairs.deadMm, stairs.stepMm);
  const second = growLeg(first.outline, first.legEnd, reach, legWidthMm);
  return second.outline === first.outline ? null : second;
}

/** `leg` as it should be drawn on top of `base`: when the leg grew across the
 *  shape the loop crosses itself, so the leg is added to the shape instead. */
function resolveLeg(base: Point[], leg: SideDrag): SideDrag {
  if (!leg.legRect || isSimplePolygon(leg.outline)) return leg;
  const merged = applyRect(base, leg.legRect[0], leg.legRect[1], 'add');
  return merged ? { ...leg, outline: merged, legEnd: undefined } : leg;
}

/** Side `edgeIndex` carried `acrossMm` over the shape, when that leaves a
 *  loop whose sides cross: what the side swept over is added to the shape
 *  (carried out) or cut out of it (carried in). Null when it is not one solid
 *  shape any more. */
function sweepSide(outline: Point[], edgeIndex: number, acrossMm: number): Point[] | null {
  const normal = edgeNormal(outline, edgeIndex);
  if (!normal || acrossMm === 0) return null;
  const from = outline[edgeIndex];
  const to = outline[(edgeIndex + 1) % outline.length];
  return applyRect(outline, from, add(to, normal, acrossMm), acrossMm > 0 ? 'add' : 'cut');
}

/** Side `edgeIndex` pushed `acrossMm` out first, then — from that new
 *  position — a leg grown `alongMm` off one end. So a run pulled out to 100"
 *  and then turned keeps its 100": the leg is cut out of it, leaving the side
 *  next to the leg exactly 100" less the leg's width. Turned again (`stairs`),
 *  a second leg grows off the end of the first, the same width, the way the
 *  pointer went — up, then right cuts the same step as right, then up. A side
 *  brought back within `joinMm` of its neighbour's line (a leg's end pulled
 *  back to the run it grew from) lands on it and merges into it. A side or
 *  leg carried across other sides is allowed: the shape it covers (or cuts
 *  away) is what is drawn, never a tangle of crossing lines. */
export function dragSideOutline(
  outline: Point[], edgeIndex: number, acrossMm: number, alongMm: number, legWidthMm: number, joinMm = 0,
  stairs?: Stairs,
): SideDrag {
  const across = snapAcrossToJoin(outline, edgeIndex, acrossMm, joinMm);
  const pushed = pushEdge(outline, edgeIndex, across);
  const side = { outline: pushed, moved: [pushed[edgeIndex], pushed[(edgeIndex + 1) % pushed.length]] };
  if (alongMm !== 0 && !isSimplePolygon(joinOutline(pushed, side.moved))) {
    // The side itself already crossed the shape: no corner left to grow a leg
    // off, so what it swept over is all that changes.
    const swept = sweepSide(outline, edgeIndex, across);
    if (swept) return { outline: repairOutline(swept), moved: side.moved };
  }
  const first = alongMm === 0 ? side : resolveLeg(pushed, growLeg(pushed, edgeIndex, alongMm, legWidthMm));
  let final: SideDrag = first.outline === pushed ? side : first;
  const normal = edgeNormal(outline, edgeIndex);
  if (stairs && normal) {
    const second = growSecondLeg(final, normal, acrossMm, legWidthMm, stairs);
    if (second) final = resolveLeg(final.outline, second);
  }
  const joined = joinOutline(final.outline, final.moved);
  const swept = final === side && !isSimplePolygon(joined) ? sweepSide(outline, edgeIndex, across) : null;
  return { outline: repairOutline(swept ?? joined), moved: final.moved };
}
