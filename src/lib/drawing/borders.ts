// The Border tool: reshaping one side of a piece into a curve or a bump.
//   Full Radius  the whole side becomes one arc (out = away from the stone).
//   Bump         the side steps out (or in) by a height between two straight
//                gaps — three corners' worth of new sides.
//   Arc Bump     two straight gaps with a single arc between them.
// Pure and index-careful: a piece's per-side settings are keyed by side
// index, so every side after the one reshaped shifts by however many sides it
// became. The sides the reshape creates are lettered like any others
// (A, B, C ... by index), which is how the tool's inputs name them.
// One border per side: every side a reshape makes is tagged with a shared
// `borderId`, a tagged side refuses another reshape, and `removeBorder`
// puts the original straight side back so a different one can be applied.

import type { BorderStyle, PieceEdge, Point } from '@/types/drawing';
import { DEFAULT_BORDER_GAP_MM, DEFAULT_BORDER_HEIGHT_MM, MAX_DIMENSION_MM, MIN_EDGE_LENGTH_MM } from './constants';
import { distance, isClockwise } from './geometry';
import { edgeLetter } from './labels';

export type { BorderStyle };
type BorderKind = 'fullRadius' | 'bump' | 'arcBump';

interface BorderStyleDef {
  id: BorderStyle;
  label: string;
  kind: BorderKind;
  /** +1 pushes the side away from the stone, -1 into it. */
  direction: 1 | -1;
}

export const BORDER_STYLES: BorderStyleDef[] = [
  { id: 'fullRadiusOut', label: 'Full Radius Out', kind: 'fullRadius', direction: 1 },
  { id: 'fullRadiusIn', label: 'Full Radius In', kind: 'fullRadius', direction: -1 },
  { id: 'bumpOut', label: 'Bump Out', kind: 'bump', direction: 1 },
  { id: 'bumpIn', label: 'Bump In', kind: 'bump', direction: -1 },
  { id: 'arcBumpOut', label: 'Arc Bump Out', kind: 'arcBump', direction: 1 },
  { id: 'arcBumpIn', label: 'Arc Bump In', kind: 'arcBump', direction: -1 },
];

export const DEFAULT_BORDER_STYLE: BorderStyle = 'fullRadiusOut';

export function borderStyleDef(style: BorderStyle): BorderStyleDef {
  return BORDER_STYLES.find((s) => s.id === style) ?? BORDER_STYLES[0];
}

/** What the user types: the first gap runs from the side's start corner, the
 *  second back from its end corner; `heightMm` is the bump or arc height. */
export interface BorderParams {
  gap1Mm: number;
  heightMm: number;
  gap2Mm: number;
}

export const DEFAULT_BORDER_PARAMS: BorderParams = {
  gap1Mm: DEFAULT_BORDER_GAP_MM, heightMm: DEFAULT_BORDER_HEIGHT_MM, gap2Mm: DEFAULT_BORDER_GAP_MM,
};

export interface BorderField {
  key: keyof BorderParams;
  /** The letter(s) the side(s) this value sets will carry once applied, e.g. "E" or "F, H". */
  letters: string;
  caption: string;
}

/** The inputs a style asks for, each named by the side letters it produces
 *  when applied to side `edgeIndex` — so "E" in the form is the "E" on the
 *  drawing afterwards. */
export function borderFields(style: BorderStyle, edgeIndex: number): BorderField[] {
  const at = (offset: number) => edgeLetter(edgeIndex + offset);
  switch (borderStyleDef(style).kind) {
    case 'fullRadius':
      return [{ key: 'heightMm', letters: at(0), caption: 'Arc height' }];
    case 'bump':
      return [
        { key: 'gap1Mm', letters: at(0), caption: 'Gap' },
        { key: 'heightMm', letters: `${at(1)}, ${at(3)}`, caption: 'Height' },
        { key: 'gap2Mm', letters: at(4), caption: 'Gap' },
      ];
    case 'arcBump':
      return [
        { key: 'gap1Mm', letters: at(0), caption: 'Gap' },
        { key: 'heightMm', letters: at(1), caption: 'Arch height' },
        { key: 'gap2Mm', letters: at(2), caption: 'Gap' },
      ];
  }
}

export interface OutlineWithEdges {
  outline: Point[];
  edges: PieceEdge[];
}

export type BorderResult = ({ ok: true } & OutlineWithEdges) | { ok: false; error: string };

const fail = (error: string): BorderResult => ({ ok: false, error });

/** `outline` / `edges` after reshaping side `edgeIndex`, or why it cannot be. */
export function applyBorder(
  piece: OutlineWithEdges, edgeIndex: number, style: BorderStyle, params: BorderParams,
  borderId: string = crypto.randomUUID(),
): BorderResult {
  const { outline, edges } = piece;
  const from = outline[edgeIndex];
  const to = outline[(edgeIndex + 1) % outline.length];
  if (!from || !to) return fail('That side no longer exists.');
  const length = distance(from, to);
  if (length < MIN_EDGE_LENGTH_MM) return fail('That side is too short to reshape.');
  if (edges.find((e) => e.index === edgeIndex)?.borderId) {
    return fail(`Side ${edgeLetter(edgeIndex)} already has a border. Make it standard before applying another.`);
  }

  if (edges.find((e) => e.index === edgeIndex)?.cornerId) {
    return fail(`Side ${edgeLetter(edgeIndex)} belongs to a corner change. Make that corner standard before applying a border.`);
  }

  const { kind, direction } = borderStyleDef(style);
  const { heightMm, gap1Mm, gap2Mm } = params;
  const letter = edgeLetter(edgeIndex);
  if (!Number.isFinite(heightMm) || heightMm <= 0) return fail('Enter a height above zero.');
  if (heightMm > MAX_DIMENSION_MM) return fail('That height is too large.');

  // The stone is on the right of travel for a clockwise outline, so "out" is the left.
  const outward = (isClockwise(outline) ? 1 : -1) * direction;
  const original = edges.find((e) => e.index === edgeIndex);
  const inherited: PieceEdge = { ...original, index: edgeIndex };
  delete inherited.arcHeightMm;
  const tag = { borderId, borderStyle: style };
  const others = edges.filter((e) => e.index !== edgeIndex);

  if (kind === 'fullRadius') {
    if (heightMm > length / 2) return fail(`Side ${letter} is too short for that arc height.`);
    const bowed: PieceEdge = { ...inherited, arcHeightMm: outward * heightMm, ...tag };
    return { ok: true, outline, edges: [...others, bowed].sort((a, b) => a.index - b.index) };
  }

  if (!Number.isFinite(gap1Mm) || !Number.isFinite(gap2Mm) || gap1Mm <= 0 || gap2Mm <= 0) {
    return fail('Gaps must be above zero.');
  }
  const run = length - gap1Mm - gap2Mm;
  if (run < MIN_EDGE_LENGTH_MM) return fail(`The gaps leave no room on side ${letter}.`);
  if (kind === 'arcBump' && heightMm > run / 2) return fail('The arch is too tall for the space between the gaps.');

  const dir = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const push = { x: -dir.y * outward * heightMm, y: dir.x * outward * heightMm };
  const start = { x: from.x + dir.x * gap1Mm, y: from.y + dir.y * gap1Mm };
  const end = { x: to.x - dir.x * gap2Mm, y: to.y - dir.y * gap2Mm };
  const lift = (p: Point): Point => ({ x: p.x + push.x, y: p.y + push.y });

  const newCorners = kind === 'bump' ? [start, lift(start), lift(end), end] : [start, end];
  // The side's new pieces, in order: straight gaps and the middle carry what
  // the side had (profile, splash, ...); the legs of a bump only its profile.
  const legs: PieceEdge = { index: 0 };
  if (inherited.code !== undefined) legs.code = inherited.code;
  if (inherited.edgeTypeId !== undefined) legs.edgeTypeId = inherited.edgeTypeId;
  const pieces: PieceEdge[] = kind === 'bump'
    ? [inherited, legs, inherited, legs, inherited]
    : [inherited, { ...inherited, arcHeightMm: outward * heightMm }, inherited];
  const added = newCorners.length;

  const shifted = others.map((e) => (e.index > edgeIndex ? { ...e, index: e.index + added } : e));
  const created = pieces
    // Every side the reshape made is tagged, so the whole border can be found again.
    .map((e, i) => ({ ...e, ...tag, index: edgeIndex + i }));
  return {
    ok: true,
    outline: [...outline.slice(0, edgeIndex + 1), ...newCorners, ...outline.slice(edgeIndex + 1)],
    edges: [...shifted, ...created].sort((a, b) => a.index - b.index),
  };
}

/** Every side that belongs to the same border as side `edgeIndex`, in order —
 *  just that side when it has none. */
export function borderGroup(edges: PieceEdge[], edgeIndex: number): number[] {
  const id = edges.find((e) => e.index === edgeIndex)?.borderId;
  if (!id) return [edgeIndex];
  return edges.filter((e) => e.borderId === id).map((e) => e.index).sort((a, b) => a - b);
}

/** The style of the border on side `edgeIndex`, or undefined when it has none. */
export function borderOn(edges: PieceEdge[], edgeIndex: number): BorderStyle | undefined {
  const edge = edges.find((e) => e.index === edgeIndex);
  return edge?.borderId ? edge.borderStyle : undefined;
}

/** Puts the straight side back where a border was: the border's corners are
 *  taken out and its sides become one again, keeping the settings the side had
 *  before (profile, splash ...). Fails when the border's sides are no longer
 *  side by side (something else was done to the outline in between). */
export function removeBorder(piece: OutlineWithEdges, edgeIndex: number): BorderResult {
  const { outline, edges } = piece;
  if (!edges.find((e) => e.index === edgeIndex)?.borderId) return fail('That side has no border to remove.');
  const group = borderGroup(edges, edgeIndex);
  const first = group[0];
  const last = group[group.length - 1];
  if (last - first + 1 !== group.length || last >= outline.length) {
    return fail('This border has been changed since it was applied, so it cannot be made standard automatically.');
  }

  const merged: PieceEdge = { ...edges.find((e) => e.index === first), index: first };
  delete merged.arcHeightMm;
  delete merged.borderId;
  delete merged.borderStyle;
  const removed = last - first;
  const nextEdges = edges
    .filter((e) => e.index < first || e.index > last)
    .map((e) => (e.index > last ? { ...e, index: e.index - removed } : e));
  if (Object.keys(merged).length > 1) nextEdges.push(merged);
  return {
    ok: true,
    // Corners first + 1 .. last are the border's own; the first side's start and the last side's end stay.
    outline: outline.filter((_, i) => i <= first || i > last),
    edges: nextEdges.sort((a, b) => a.index - b.index),
  };
}
