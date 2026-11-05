// Cutout geometry and placement rules. A cutout is real geometry in its
// piece's local coordinate space (the same space as `Piece.outline`), so its
// outline, area and clearance checks all come from here — never from how it
// happens to be drawn.

import type { Cutout, CutoutShape, CutoutType, Piece, Point } from '@/types/drawing';
import {
  CUTOUT_EDGE_CLEARANCE_MM, CUTOUT_SPACING_MM, MM_PER_INCH, ROUND_CUTOUT_SEGMENTS,
} from './constants';
import { area, bounds, rotatePoint } from './geometry';
import { polygonInside, polygonsOverlap, boundaryDistance } from './polygon';

export const CUTOUT_TYPE_LABELS: Record<CutoutType, string> = {
  sink: 'Sink',
  cooktop: 'Cooktop',
  faucet: 'Faucet hole',
  soap_dispenser: 'Soap dispenser',
  outlet: 'Electrical outlet',
  custom: 'Custom cutout',
};

export const CUTOUT_TYPES = Object.keys(CUTOUT_TYPE_LABELS) as CutoutType[];

interface CutoutDefaults {
  shape: CutoutShape;
  widthMm?: number;
  depthMm?: number;
  diameterMm?: number;
}

/** Starting size for each type — sensible stock sizes the user then edits to
 *  the real appliance. Inches converted once here, mm everywhere else. */
export const CUTOUT_DEFAULTS: Record<CutoutType, CutoutDefaults> = {
  sink: { shape: 'rect', widthMm: 30 * MM_PER_INCH, depthMm: 18 * MM_PER_INCH },
  cooktop: { shape: 'rect', widthMm: 30 * MM_PER_INCH, depthMm: 21 * MM_PER_INCH },
  faucet: { shape: 'round', diameterMm: 1.375 * MM_PER_INCH },
  soap_dispenser: { shape: 'round', diameterMm: 1.25 * MM_PER_INCH },
  outlet: { shape: 'rect', widthMm: 2.75 * MM_PER_INCH, depthMm: 4.5 * MM_PER_INCH },
  custom: { shape: 'rect', widthMm: 12 * MM_PER_INCH, depthMm: 12 * MM_PER_INCH },
};

/** A new cutout of `type` centred on `center`, at that type's default size. */
export function newCutout(id: string, type: CutoutType, center: Point): Cutout {
  const defaults = CUTOUT_DEFAULTS[type];
  return { id, type, center, rotationDeg: 0, ...defaults };
}

/** The shape a cutout is drawn as — falls back sensibly for cutouts saved
 *  before `shape` existed. */
export function cutoutShape(cutout: Cutout): CutoutShape {
  if (cutout.shape) return cutout.shape;
  if (cutout.outline && cutout.outline.length >= 3) return 'polygon';
  if (cutout.diameterMm !== undefined && cutout.widthMm === undefined) return 'round';
  return 'rect';
}

/** The opening's outline in the piece's local coordinates, clockwise. Round
 *  openings are approximated by a regular polygon. Returns [] when the
 *  cutout has no usable size. */
export function cutoutOutline(cutout: Cutout): Point[] {
  const shape = cutoutShape(cutout);
  let relative: Point[];
  if (shape === 'round') {
    const r = (cutout.diameterMm ?? 0) / 2;
    if (r <= 0) return [];
    relative = Array.from({ length: ROUND_CUTOUT_SEGMENTS }, (_, i) => {
      const angle = -(2 * Math.PI * i) / ROUND_CUTOUT_SEGMENTS;
      return { x: r * Math.cos(angle), y: r * Math.sin(angle) };
    });
  } else if (shape === 'polygon') {
    relative = cutout.outline ?? [];
  } else {
    const hw = (cutout.widthMm ?? 0) / 2;
    const hd = (cutout.depthMm ?? 0) / 2;
    if (hw <= 0 || hd <= 0) return [];
    relative = [{ x: -hw, y: hd }, { x: hw, y: hd }, { x: hw, y: -hd }, { x: -hw, y: -hd }];
  }
  const rotation = cutout.rotationDeg ?? 0;
  return relative.map((p) => {
    const r = rotatePoint(p, rotation);
    return { x: r.x + cutout.center.x, y: r.y + cutout.center.y };
  });
}

/** Area of the opening in mm². */
export function cutoutArea(cutout: Cutout): number {
  const outline = cutoutOutline(cutout);
  return outline.length >= 3 ? area(outline) : 0;
}

export interface PlacementIssue {
  /** The other cutout involved, for an overlap — the problem belongs to both. */
  otherId?: string;
  cutoutId: string;
  message: string;
}

/** Everything wrong with where a piece's cutouts sit: unusable size, not
 *  fully inside the piece (or too close to its edge), or overlapping /
 *  crowding another cutout. One message per problem, naming the cutout. */
export function validateCutouts(piece: Pick<Piece, 'outline' | 'cutouts'>): PlacementIssue[] {
  const issues: PlacementIssue[] = [];
  const outlines = piece.cutouts.map(cutoutOutline);

  piece.cutouts.forEach((cutout, i) => {
    const name = cutout.label || CUTOUT_TYPE_LABELS[cutout.type];
    const outline = outlines[i];
    if (outline.length < 3) {
      issues.push({ cutoutId: cutout.id, message: `${name} needs a width and height (or a diameter) above zero.` });
      return;
    }
    if (!polygonInside(outline, piece.outline, CUTOUT_EDGE_CLEARANCE_MM)) {
      issues.push({
        cutoutId: cutout.id,
        message: `${name} must sit fully inside the piece, at least ${CUTOUT_EDGE_CLEARANCE_MM}mm from any edge.`,
      });
    }
    for (let j = 0; j < i; j += 1) {
      if (outlines[j].length < 3) continue;
      const other = piece.cutouts[j];
      const crowded = polygonsOverlap(outline, outlines[j])
        || boundaryDistance(outline, outlines[j]) < CUTOUT_SPACING_MM;
      if (crowded) {
        const otherName = other.label || CUTOUT_TYPE_LABELS[other.type];
        issues.push({ cutoutId: cutout.id, otherId: other.id, message: `${name} overlaps or touches ${otherName}.` });
      }
    }
  });
  return issues;
}

/** Position of a cutout's centre measured from the piece's left and top
 *  edges (bounding box), the way a template reads — not the raw local
 *  coordinates, whose origin and Y direction are an internal convention. */
export function centerFromBoundsMm(piece: Pick<Piece, 'outline'>, center: Point): { fromLeft: number; fromTop: number } {
  const b = bounds(piece.outline);
  return { fromLeft: center.x - b.minX, fromTop: b.maxY - center.y };
}

/** Inverse of centerFromBoundsMm. */
export function centerFromOffsets(piece: Pick<Piece, 'outline'>, fromLeft: number, fromTop: number): Point {
  const b = bounds(piece.outline);
  return { x: b.minX + fromLeft, y: b.maxY - fromTop };
}

/** The first placement problem `patch` would cause for `cutout` on `piece`, or
 *  null when the change leaves it valid. Lets an input reject a bad value
 *  with a reason instead of saving a cutout that no longer fits. */
export function cutoutPatchProblem(piece: Pick<Piece, 'outline' | 'cutouts'>, cutout: Cutout, patch: Partial<Cutout>): string | null {
  const proposed = { ...cutout, ...patch };
  const issues = validateCutouts({
    outline: piece.outline,
    cutouts: piece.cutouts.map((c) => (c.id === cutout.id ? proposed : c)),
  });
  return issues.find((issue) => issue.cutoutId === cutout.id || issue.otherId === cutout.id)?.message ?? null;
}

const ROUND_TO_POLYGON_SEGMENTS = 16;
const FALLBACK_SIZE_MM = 100;

/** Fields to patch in when changing a cutout's shape, so its size carries over
 *  instead of resetting: a rectangle becomes the round opening that fits its
 *  longer side, a round one the square of its diameter, and either becomes
 *  editable custom geometry matching what is drawn now. */
export function convertCutoutShape(cutout: Cutout, to: CutoutShape): Partial<Cutout> {
  const from = cutoutShape(cutout);
  if (from === to) return {};
  const extent = (): { w: number; d: number } => {
    if (from === 'round') return { w: cutout.diameterMm ?? FALLBACK_SIZE_MM, d: cutout.diameterMm ?? FALLBACK_SIZE_MM };
    if (from === 'rect') return { w: cutout.widthMm ?? FALLBACK_SIZE_MM, d: cutout.depthMm ?? FALLBACK_SIZE_MM };
    const b = bounds(cutout.outline ?? []);
    return { w: b.maxX - b.minX || FALLBACK_SIZE_MM, d: b.maxY - b.minY || FALLBACK_SIZE_MM };
  };
  const { w, d } = extent();
  if (to === 'round') return { shape: 'round', diameterMm: Math.max(w, d) };
  if (to === 'rect') return { shape: 'rect', widthMm: w, depthMm: d };
  const relative = from === 'round'
    ? Array.from({ length: ROUND_TO_POLYGON_SEGMENTS }, (_, i) => {
      const angle = -(2 * Math.PI * i) / ROUND_TO_POLYGON_SEGMENTS;
      return { x: (w / 2) * Math.cos(angle), y: (w / 2) * Math.sin(angle) };
    })
    : [{ x: -w / 2, y: d / 2 }, { x: w / 2, y: d / 2 }, { x: w / 2, y: -d / 2 }, { x: -w / 2, y: -d / 2 }];
  return { shape: 'polygon', outline: relative };
}
