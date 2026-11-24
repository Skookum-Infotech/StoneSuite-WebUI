// Curved sides. A side of a piece is still a straight chord between two
// corners in `Piece.outline`; `PieceEdge.arcHeightMm` bows it into a circular
// arc. The height is the sagitta (the gap between the chord's midpoint and the
// arc's crown), signed against the direction of travel: positive bulges to the
// LEFT of corner i -> corner i+1, which for the usual clockwise outline is
// away from the stone. Everything here is pure math in the piece's own mm.

import type { PieceEdge, Point } from '@/types/drawing';
import { ARC_SEGMENTS } from './constants';
import { distance, isClockwise, outlineEdges } from './geometry';

/** The arc height actually drawn: a chord can only be bowed up to a half
 *  circle (height = half the chord), so a side that was shortened after it was
 *  curved settles on a semicircle instead of an impossible shape. */
export function effectiveArcHeight(chordMm: number, arcHeightMm: number): number {
  const limit = chordMm / 2;
  return Math.sign(arcHeightMm) * Math.min(Math.abs(arcHeightMm), limit);
}

/** Arc height of side `index`, 0 when it is straight. */
export function arcHeightOf(edges: PieceEdge[] | undefined, index: number): number {
  return edges?.find((e) => e.index === index)?.arcHeightMm ?? 0;
}

/** Radius of the circle through both ends of a chord with this sagitta. */
export function arcRadius(chordMm: number, heightMm: number): number {
  const h = Math.abs(heightMm);
  return (chordMm * chordMm / 4 + h * h) / (2 * h);
}

/** Length along the curve (what an edge profile is polished along). */
export function arcLength(chordMm: number, arcHeightMm: number): number {
  const h = Math.abs(effectiveArcHeight(chordMm, arcHeightMm));
  if (h === 0) return chordMm;
  const r = arcRadius(chordMm, h);
  return 2 * r * Math.asin(Math.min(1, chordMm / (2 * r)));
}

/** Area between the chord and the arc. */
export function arcSegmentArea(chordMm: number, arcHeightMm: number): number {
  const h = Math.abs(effectiveArcHeight(chordMm, arcHeightMm));
  if (h === 0) return 0;
  const r = arcRadius(chordMm, h);
  const angle = 2 * Math.asin(Math.min(1, chordMm / (2 * r)));
  return (r * r / 2) * (angle - Math.sin(angle));
}

/** Points strictly between `from` and `to` along the arc (not the ends). */
export function arcPoints(from: Point, to: Point, arcHeightMm: number, segments: number = ARC_SEGMENTS): Point[] {
  const chord = distance(from, to);
  const height = effectiveArcHeight(chord, arcHeightMm);
  if (chord === 0 || height === 0) return [];
  const r = arcRadius(chord, height);
  const dir = { x: (to.x - from.x) / chord, y: (to.y - from.y) / chord };
  const left = { x: -dir.y, y: dir.x };
  // The circle's centre sits (r - |h|) behind the crown, on the far side from the bulge.
  const side = Math.sign(height);
  const mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
  const centre = { x: mid.x - left.x * side * (r - Math.abs(height)), y: mid.y - left.y * side * (r - Math.abs(height)) };
  const startAngle = Math.atan2(from.y - centre.y, from.x - centre.x);
  const total = 2 * Math.asin(Math.min(1, chord / (2 * r)));
  // Left-bulging (positive) arcs run clockwise round their centre as seen
  // y-up; right-bulging ones the other way.
  const turn = -side * total;
  const points: Point[] = [];
  for (let i = 1; i < segments; i++) {
    const a = startAngle + (turn * i) / segments;
    points.push({ x: centre.x + r * Math.cos(a), y: centre.y + r * Math.sin(a) });
  }
  return points;
}

/** True when any side of the piece is curved. */
export function hasArcs(edges: PieceEdge[] | undefined): boolean {
  return (edges ?? []).some((e) => Boolean(e.arcHeightMm));
}

/** The outline with every curved side replaced by its approximating points —
 *  the same list back (by value) when nothing is curved. */
export function outlinePolyline(outline: Point[], edges: PieceEdge[] | undefined, segments: number = ARC_SEGMENTS): Point[] {
  if (!hasArcs(edges)) return outline;
  return outlineEdges(outline).flatMap(([from, to], i) => [from, ...arcPoints(from, to, arcHeightOf(edges, i), segments)]);
}

/** Area enclosed by the real (curved) outline, in mm². */
export function outlineAreaWithArcs(outline: Point[], edges: PieceEdge[] | undefined, flatArea: number): number {
  if (!hasArcs(edges)) return flatArea;
  // A left bulge adds stone on a clockwise outline and takes it away on a counter-clockwise one.
  const direction = isClockwise(outline) ? 1 : -1;
  const extra = outlineEdges(outline).reduce((sum, [from, to], i) => (
    sum + Math.sign(arcHeightOf(edges, i)) * arcSegmentArea(distance(from, to), arcHeightOf(edges, i))
  ), 0);
  return flatArea + direction * extra;
}

/** Perimeter along the real (curved) sides, in mm. */
export function perimeterWithArcs(outline: Point[], edges: PieceEdge[] | undefined): number {
  return outlineEdges(outline).reduce((sum, [from, to], i) => sum + arcLength(distance(from, to), arcHeightOf(edges, i)), 0);
}

/** SVG path data for one side already in screen coordinates (y down): a
 *  straight `L`, or an `A` arc that bows the way `arcHeightMm` says it does. */
export function sidePath(from: Point, to: Point, arcHeightMm: number): string {
  const chord = distance(from, to);
  const height = effectiveArcHeight(chord, arcHeightMm);
  if (chord === 0 || height === 0) return `L${to.x},${to.y}`;
  const r = arcRadius(chord, height);
  // Screen y is world y flipped, but the picture is the same way up, so a
  // left bulge is still the clockwise (sweep 1) one.
  return `A${r},${r} 0 0 ${height > 0 ? 1 : 0} ${to.x},${to.y}`;
}

/** Closed SVG path through `screenPoints` (corners, y down) with curved sides. */
export function outlinePath(screenPoints: Point[], edges: PieceEdge[] | undefined): string {
  if (screenPoints.length === 0) return '';
  const parts = screenPoints.map((p, i) => sidePath(p, screenPoints[(i + 1) % screenPoints.length], arcHeightOf(edges, i)));
  return `M${screenPoints[0].x},${screenPoints[0].y} ${parts.join(' ')} Z`;
}
