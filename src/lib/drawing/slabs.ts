// Laying pieces (and profile pieces — lib/drawing/slabPlaceables.ts) on
// slabs: where an outline lands on a slab, whether it fits, and a first-fit
// starting spot for an item just picked.
//
// Slab space is y-down millimetres with the origin at the slab's top-left, so it
// matches the photo laid under the pieces. A piece's own outline is y-up (the
// board's world), so it is flipped on the way in. See SlabPlacement for the
// transform a saved placement means.

import type { PieceEdge, Point, SlabPlacement } from '@/types/drawing';
import { outlinePolyline } from './arcs';
import { bounds } from './geometry';
import { pointInPolygon } from './polygon';

/** The minimum a piece or a profile piece needs for slab placement: an
 *  outline, and the edges (for arc flattening) when it has any. A profile
 *  piece is always a plain rectangle, so it has none. `Piece` itself already
 *  satisfies this shape, so every existing caller below keeps working
 *  unchanged. */
export interface Placeable {
  outline: Point[];
  edges?: PieceEdge[];
}

/** `Placeable` plus whatever `othersOnSlab`/`usedSlabIds` need to tell items
 *  on a slab apart and find where (if anywhere) each one is placed. Both
 *  `Piece` and `lib/drawing/slabPlaceables.ts`'s `SlabPlaceable` (a piece OR
 *  one of its painted Profiles sides) already satisfy this, so a caller that
 *  only ever deals in real pieces can keep passing `Piece[]` unchanged. */
export interface SlabItem extends Placeable {
  id: string;
  slab?: SlabPlacement;
}

/** How far apart the first-fit scan tries positions. */
export const SLAB_SCAN_STEP_MM = 25.4;
/** Pieces nudged with the arrow keys move this far. */
export const SLAB_NUDGE_MM = 10;
/** A piece within this of the slab edge counts as inside — float noise, not stone. */
const EDGE_TOLERANCE_MM = 0.01;
/** Overlap is judged on a grid of sample points this far apart, so two pieces sitting
 *  flush against each other (sharing an edge) do not count as overlapping. */
const OVERLAP_SAMPLE_MM = 5;
/** Caps the samples taken for one pair, so a huge overlap stays quick to test. */
const MAX_OVERLAP_SAMPLES = 40000;
const QUARTER_TURN_DEG = 90;
const FULL_TURN_DEG = 360;
/** The turns a first-fit scan tries, in order: as drawn, then on its side. */
const SCAN_ROTATIONS_DEG = [0, QUARTER_TURN_DEG];

export interface SlabSize {
  lengthMm: number;
  widthMm: number;
}

export type SlabFit = 'fits' | 'outside' | 'overlap';

function rotateClockwise(p: Point, deg: number): Point {
  const rad = (deg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return { x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos };
}

/** The piece's outline (curves flattened) in y-down space, rotated, with its
 *  bounding box's top-left at the origin. */
function normalisedOutline(item: Placeable, rotationDeg: number): Point[] {
  const turned = outlinePolyline(item.outline, item.edges ?? [])
    .map((p) => rotateClockwise({ x: p.x, y: -p.y }, rotationDeg));
  const b = bounds(turned);
  return turned.map((p) => ({ x: p.x - b.minX, y: p.y - b.minY }));
}

/** The shift that, after a piece's local point is flipped to y-down and rotated by
 *  the placement, lands it on the slab: slabPoint = rotate(flipY(local)) + offset.
 *  It is what lets the slab's photo be drawn inside the piece on the board — apply
 *  the inverse (flip, rotate back, subtract the offset) to slab space. */
export function slabOffset(item: Placeable, placement: SlabPlacement): Point {
  const turned = outlinePolyline(item.outline, item.edges ?? [])
    .map((p) => rotateClockwise({ x: p.x, y: -p.y }, placement.rotationDeg));
  const b = bounds(turned);
  return { x: placement.x - b.minX, y: placement.y - b.minY };
}

/** Where the piece's outline lies on the slab, in slab millimetres. */
export function placedOutline(item: Placeable, placement: SlabPlacement): Point[] {
  return normalisedOutline(item, placement.rotationDeg).map((p) => ({ x: p.x + placement.x, y: p.y + placement.y }));
}

/** The width and height of the piece once turned, as laid on a slab. */
export function placedSize(item: Placeable, rotationDeg: number): { width: number; height: number } {
  const b = bounds(normalisedOutline(item, rotationDeg));
  return { width: b.maxX - b.minX, height: b.maxY - b.minY };
}

/** The slab's rectangle in slab space. */
export function slabRect(slab: SlabSize): Point[] {
  return [
    { x: 0, y: 0 }, { x: slab.lengthMm, y: 0 }, { x: slab.lengthMm, y: slab.widthMm }, { x: 0, y: slab.widthMm },
  ];
}

/** Whether two outlines share any area. Touching along an edge or at a corner is not
 *  sharing area — pieces are routinely laid flush. */
export function interiorsOverlap(a: Point[], b: Point[]): boolean {
  const ba = bounds(a);
  const bb = bounds(b);
  const minX = Math.max(ba.minX, bb.minX);
  const maxX = Math.min(ba.maxX, bb.maxX);
  const minY = Math.max(ba.minY, bb.minY);
  const maxY = Math.min(ba.maxY, bb.maxY);
  if (maxX - minX <= EDGE_TOLERANCE_MM || maxY - minY <= EDGE_TOLERANCE_MM) return false;
  const step = Math.max(OVERLAP_SAMPLE_MM, Math.sqrt(((maxX - minX) * (maxY - minY)) / MAX_OVERLAP_SAMPLES));
  for (let y = minY + step / 2; y < maxY; y += step) {
    for (let x = minX + step / 2; x < maxX; x += step) {
      const p = { x, y };
      if (pointInPolygon(p, a) && pointInPolygon(p, b)) return true;
    }
  }
  return false;
}

/** Whether a placed outline sits wholly inside the slab and clear of the other
 *  pieces already on it. Off the slab wins over overlapping. The slab is a
 *  rectangle, so "inside" is just the outline's bounding box lying within it. */
export function slabFit(outline: Point[], slab: SlabSize, others: Point[][]): SlabFit {
  const b = bounds(outline);
  const inside = b.minX >= -EDGE_TOLERANCE_MM && b.minY >= -EDGE_TOLERANCE_MM
    && b.maxX <= slab.lengthMm + EDGE_TOLERANCE_MM && b.maxY <= slab.widthMm + EDGE_TOLERANCE_MM;
  if (!inside) return 'outside';
  return others.some((other) => interiorsOverlap(outline, other)) ? 'overlap' : 'fits';
}

/** Every other item's (piece's or profile piece's) outline on the same slab,
 *  in slab space. */
export function othersOnSlab(items: SlabItem[], slabId: string, exceptId: string): Point[][] {
  return items
    .filter((it) => it.id !== exceptId && it.slab?.slabId === slabId)
    .map((it) => placedOutline(it, it.slab as SlabPlacement));
}

/** A starting placement for an item (a piece or a profile piece) just picked
 *  for a slab: the first spot, scanning left to right and top to bottom, as
 *  drawn and then on its side, where it fits clear of the items already
 *  there. When nothing fits it goes to the top-left as drawn, so it shows
 *  red where the user can see it and drag it. */
export function autoPlace(item: Placeable, slabId: string, slab: SlabSize, others: Point[][]): SlabPlacement {
  for (const rotationDeg of SCAN_ROTATIONS_DEG) {
    const { width, height } = placedSize(item, rotationDeg);
    for (let y = 0; y + height <= slab.widthMm + EDGE_TOLERANCE_MM; y += SLAB_SCAN_STEP_MM) {
      for (let x = 0; x + width <= slab.lengthMm + EDGE_TOLERANCE_MM; x += SLAB_SCAN_STEP_MM) {
        const placement = { slabId, x, y, rotationDeg };
        if (slabFit(placedOutline(item, placement), slab, others) === 'fits') return placement;
      }
    }
  }
  return { slabId, x: 0, y: 0, rotationDeg: 0 };
}

/** The same placement turned a quarter clockwise, its top-left held where it was. */
export function rotatedPlacement(placement: SlabPlacement): SlabPlacement {
  return { ...placement, rotationDeg: (placement.rotationDeg + QUARTER_TURN_DEG) % FULL_TURN_DEG };
}

/** The slab ids that have at least one piece or profile piece laid on them. */
export function usedSlabIds(items: SlabItem[]): Set<string> {
  return new Set(items.flatMap((it) => (it.slab ? [it.slab.slabId] : [])));
}
