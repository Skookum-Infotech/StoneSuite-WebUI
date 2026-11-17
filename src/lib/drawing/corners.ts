// The Corner tool: changing one corner of a piece. Two sizes are measured out
// from the corner along the two sides that meet there (P1 on the side before,
// P2 on the side after), and the corner between them is replaced:
//   Clip       a straight cut P1 -> P2.
//   Radius     a rounded corner: an arc P1 -> P2 bulging toward the old corner.
//   Radius In  a cove: an arc centred on the old corner, bulging into the stone.
//   Bump Out   the cut P1 -> P2 pushed out (or, Bump In, into the stone) by a
//              height at right angles to it — a rotated rectangle.
//   Notch      a square-cornered bite: P1, then parallel to the other side,
//              then back to P2.
// Arcs are per-side metadata (`arcHeightMm`, see arcs.ts), not outline points.
// Pure and index-careful: per-side settings are keyed by side index, so every
// side after the corner shifts by however many sides it became. The sides a
// corner change makes are lettered like any others, and tagged with a shared
// `cornerId` so the change can be found again — a tagged side refuses another
// corner change or border until `removeCorner` puts the sharp corner back.

import type { CornerStyle, PieceEdge, Point } from '@/types/drawing';
import { DEFAULT_CORNER_SIZE_MM, MAX_DIMENSION_MM, MIN_EDGE_LENGTH_MM } from './constants';
import { arcHeightOf } from './arcs';
import { distance, isClockwise } from './geometry';
import { edgeLetter } from './labels';

export type { CornerStyle };
type CornerKind = 'clip' | 'radius' | 'bump' | 'notch';

interface CornerStyleDef {
  id: CornerStyle;
  label: string;
  kind: CornerKind;
  /** +1 pushes a bump out of the stone / bows a radius round it; -1 the other way. */
  direction: 1 | -1;
}

export const CORNER_STYLES: CornerStyleDef[] = [
  { id: 'clip', label: 'Clip', kind: 'clip', direction: 1 },
  { id: 'radius', label: 'Radius', kind: 'radius', direction: 1 },
  { id: 'radiusIn', label: 'Radius In', kind: 'radius', direction: -1 },
  { id: 'bumpOut', label: 'Bump Out', kind: 'bump', direction: 1 },
  { id: 'bumpIn', label: 'Bump In', kind: 'bump', direction: -1 },
  { id: 'notch', label: 'Notch', kind: 'notch', direction: 1 },
];

export const DEFAULT_CORNER_STYLE: CornerStyle = 'clip';

export function cornerStyleDef(style: CornerStyle): CornerStyleDef {
  return CORNER_STYLES.find((s) => s.id === style) ?? CORNER_STYLES[0];
}

/** What the user types. `beforeMm` runs back from the corner along the side
 *  that arrives at it, `afterMm` along the side that leaves it; `heightMm` is a
 *  bump's height. */
export interface CornerParams {
  beforeMm: number;
  afterMm: number;
  heightMm: number;
}

export const DEFAULT_CORNER_PARAMS: CornerParams = {
  beforeMm: DEFAULT_CORNER_SIZE_MM, afterMm: DEFAULT_CORNER_SIZE_MM, heightMm: DEFAULT_CORNER_SIZE_MM,
};

export interface CornerField {
  key: keyof CornerParams;
  /** The letter(s) of the side(s) this value is measured on or sets, e.g. "C" or "E, G". */
  letters: string;
  caption: string;
}

/** The two sides that meet at corner `vertexIndex` (the corner sits at the end
 *  of the first and the start of the second), by index. */
export function cornerSides(vertexIndex: number, sideCount: number): { before: number; after: number } {
  return { before: (vertexIndex - 1 + sideCount) % sideCount, after: vertexIndex };
}

/** The inputs a style asks for. The two sizes are named by the sides they are
 *  measured along (as lettered now); a bump's height by the two new sides it
 *  makes, which take the letters from the corner's own on. */
export function cornerFields(style: CornerStyle, vertexIndex: number, sideCount: number): CornerField[] {
  const { before, after } = cornerSides(vertexIndex, sideCount);
  const sizes: CornerField[] = [
    { key: 'beforeMm', letters: edgeLetter(before), caption: 'Size' },
    { key: 'afterMm', letters: edgeLetter(after), caption: 'Size' },
  ];
  if (cornerStyleDef(style).kind !== 'bump') return sizes;
  return [
    { key: 'beforeMm', letters: edgeLetter(before), caption: 'Gap' },
    { key: 'heightMm', letters: `${edgeLetter(vertexIndex)}, ${edgeLetter(vertexIndex + 2)}`, caption: 'Height' },
    { key: 'afterMm', letters: edgeLetter(after), caption: 'Gap' },
  ];
}

export interface OutlineWithEdges {
  outline: Point[];
  edges: PieceEdge[];
}

export type CornerResult = ({ ok: true } & OutlineWithEdges) | { ok: false; error: string };

const fail = (error: string): CornerResult => ({ ok: false, error });

/** Sides of a straight corner this close to parallel are not a corner. */
const STRAIGHT_TOLERANCE = 1e-6;

const unit = (from: Point, to: Point): Point => {
  const length = distance(from, to);
  return { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
};
const along = (origin: Point, dir: Point, by: number): Point => ({ x: origin.x + dir.x * by, y: origin.y + dir.y * by });

/** `outline` / `edges` after changing corner `vertexIndex`, or why it cannot be. */
export function applyCorner(
  piece: OutlineWithEdges, vertexIndex: number, style: CornerStyle, params: CornerParams,
  cornerId: string = crypto.randomUUID(),
): CornerResult {
  const { outline, edges } = piece;
  const count = outline.length;
  const corner = outline[vertexIndex];
  if (!corner) return fail('That corner no longer exists.');
  const { before, after } = cornerSides(vertexIndex, count);
  const previous = outline[before];
  const next = outline[(vertexIndex + 1) % count];
  const lengthBefore = distance(previous, corner);
  const lengthAfter = distance(corner, next);
  if (lengthBefore < MIN_EDGE_LENGTH_MM || lengthAfter < MIN_EDGE_LENGTH_MM) return fail('A side at that corner is too short.');

  const letters = { before: edgeLetter(before), after: edgeLetter(after) };
  const edgeOf = (index: number) => edges.find((e) => e.index === index);
  for (const side of [before, after]) {
    if (arcHeightOf(edges, side) !== 0) return fail(`Side ${edgeLetter(side)} is curved. A corner change needs two straight sides.`);
    if (edgeOf(side)?.cornerId) {
      return fail(`Side ${edgeLetter(side)} already has a corner change. Make it standard before applying another.`);
    }
  }
  const sharedBorder = edgeOf(before)?.borderId;
  if (sharedBorder && sharedBorder === edgeOf(after)?.borderId) {
    return fail('That corner is part of a border. Make the border standard first.');
  }

  const { kind, direction } = cornerStyleDef(style);
  const { beforeMm, afterMm, heightMm } = params;
  if (![beforeMm, afterMm].every((v) => Number.isFinite(v) && v > 0)) return fail('Enter sizes above zero.');
  if (Math.max(beforeMm, afterMm) > MAX_DIMENSION_MM) return fail('That size is too large.');
  if (beforeMm > lengthBefore - MIN_EDGE_LENGTH_MM) return fail(`Side ${letters.before} is too short for that size.`);
  if (afterMm > lengthAfter - MIN_EDGE_LENGTH_MM) return fail(`Side ${letters.after} is too short for that size.`);
  if (kind === 'bump') {
    if (!Number.isFinite(heightMm) || heightMm <= 0) return fail('Enter a height above zero.');
    if (heightMm > MAX_DIMENSION_MM) return fail('That height is too large.');
  }

  const toBefore = unit(corner, previous);
  const toAfter = unit(corner, next);
  const turn = toBefore.x * toAfter.y - toBefore.y * toAfter.x;
  if (Math.abs(turn) < STRAIGHT_TOLERANCE) return fail('That corner is straight — there is nothing to change.');

  const start = along(corner, toBefore, beforeMm);
  const end = along(corner, toAfter, afterMm);
  const chord = distance(start, end);
  // The stone is on the right of travel for a clockwise outline, so "out" is the left.
  const outward = (isClockwise(outline) ? 1 : -1) * direction;

  let points: Point[] = [start, end];
  let bow = 0;
  if (kind === 'radius') {
    // The angle between the two sides, as seen from the corner. A rounded corner
    // sweeps what is left of a half turn; a cove, centred on the corner, sweeps it all.
    const between = Math.acos(Math.max(-1, Math.min(1, toBefore.x * toAfter.x + toBefore.y * toAfter.y)));
    const sweep = direction === 1 ? Math.PI - between : between;
    // Which side of the cut the old corner is on decides which way "round it" bows.
    const cornerSide = Math.sign((end.x - start.x) * (corner.y - start.y) - (end.y - start.y) * (corner.x - start.x));
    bow = cornerSide * direction * (chord / 2) * Math.tan(sweep / 4);
  } else if (kind === 'bump') {
    const dir = unit(start, end);
    const push = { x: -dir.y * outward * heightMm, y: dir.x * outward * heightMm };
    points = [start, { x: start.x + push.x, y: start.y + push.y }, { x: end.x + push.x, y: end.y + push.y }, end];
  } else if (kind === 'notch') {
    points = [start, { x: start.x + (end.x - corner.x), y: start.y + (end.y - corner.y) }, end];
  }

  // The new sides run from the cut's first point to its last. They take the
  // profile the two sides they join agree on (when they do); a radius's one
  // side carries the arc.
  const tag = { cornerId, cornerStyle: style };
  const shared = edgeOf(before)?.code === edgeOf(after)?.code ? edgeOf(before)?.code : undefined;
  const made: PieceEdge[] = points.slice(1).map(() => ({
    index: 0, ...(shared === undefined ? {} : { code: shared }), ...tag,
  }));
  if (bow !== 0) made[0] = { ...made[0], arcHeightMm: bow };

  // Settings per side of the new outline, in order: everything before the
  // corner keeps its place, the corner's new sides come next, then the side that
  // used to leave the corner and everything after it.
  const slots: (PieceEdge | undefined)[] = [];
  for (let side = 0; side < count; side++) {
    if (side === vertexIndex) slots.push(...made);
    slots.push(edgeOf(side));
  }
  return {
    ok: true,
    outline: [...outline.slice(0, vertexIndex), ...points, ...outline.slice(vertexIndex + 1)],
    edges: slots.flatMap((e, index) => (e && Object.keys(e).length > 1 ? [{ ...e, index }] : [])),
  };
}

/** The corner change that side `edgeIndex` belongs to, as its sides in order, or null. */
function cornerGroupOfSide(edges: PieceEdge[], edgeIndex: number): { id: string; style: CornerStyle; sides: number[] } | null {
  const edge = edges.find((e) => e.index === edgeIndex);
  if (!edge?.cornerId || !edge.cornerStyle) return null;
  const sides = edges.filter((e) => e.cornerId === edge.cornerId).map((e) => e.index).sort((a, b) => a - b);
  return { id: edge.cornerId, style: edge.cornerStyle, sides };
}

/** The corner change sitting on corner `vertexIndex` (one of the sides meeting
 *  there made by it), as its sides in order, or null for a plain corner. */
export function cornerChangeAt(
  edges: PieceEdge[], vertexIndex: number, sideCount: number,
): { id: string; style: CornerStyle; sides: number[] } | null {
  const { before, after } = cornerSides(vertexIndex, sideCount);
  return cornerGroupOfSide(edges, after) ?? cornerGroupOfSide(edges, before);
}

/** Every side that belongs to the same corner change as side `edgeIndex` — just
 *  that side when it has none. */
export function cornerGroup(edges: PieceEdge[], edgeIndex: number): number[] {
  return cornerGroupOfSide(edges, edgeIndex)?.sides ?? [edgeIndex];
}

/** Puts the sharp corner back where a corner change was: the change's own sides
 *  and corners are taken out, and the two sides either end of it run on to meet
 *  where they would have. Fails when the change's sides are no longer side by
 *  side, or the sides around it have been moved so they no longer meet ahead. */
export function removeCorner(piece: OutlineWithEdges, vertexIndex: number): CornerResult {
  const { outline, edges } = piece;
  const count = outline.length;
  const change = cornerChangeAt(edges, vertexIndex, count);
  if (!change) return fail('That corner has no change to remove.');
  const { sides } = change;
  const first = sides[0];
  const last = sides[sides.length - 1];
  const manual = 'This corner has been changed since it was applied, so it cannot be made standard automatically.';
  if (last - first + 1 !== sides.length || last + 1 >= count) return fail(manual);

  // The side coming into the change and the side leaving it, each as a line.
  const a = outline[(first - 1 + count) % count];
  const p = outline[first];
  const q = outline[last + 1];
  const b = outline[(last + 2) % count];
  const dirIn = unit(a, p);
  const dirOut = unit(q, b);
  const cross = dirIn.x * dirOut.y - dirIn.y * dirOut.x;
  if (!Number.isFinite(cross) || Math.abs(cross) < STRAIGHT_TOLERANCE) return fail(manual);
  // Where the line through a, p meets the line through q, b.
  const reach = ((q.x - p.x) * dirOut.y - (q.y - p.y) * dirOut.x) / cross;
  const corner = along(p, dirIn, reach);
  if (reach <= 0 || (q.x - corner.x) * dirOut.x + (q.y - corner.y) * dirOut.y <= 0) return fail(manual);

  const removed = sides.length;
  return {
    ok: true,
    outline: [...outline.slice(0, first), corner, ...outline.slice(last + 2)],
    edges: edges
      .filter((e) => e.index < first || e.index > last)
      .map((e) => (e.index > last ? { ...e, index: e.index - removed } : e))
      .sort((x, y) => x.index - y.index),
  };
}
