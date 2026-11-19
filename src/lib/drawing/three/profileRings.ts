// A slab with finished edges as a stack of horizontal slices. Each slice is the piece's outline
// with every side pulled in by how much its finish takes off at that height (edgeProfile.ts);
// joining the slices gives the bevel, bullnose or ogee along each side, and corners between
// sides with different finishes meet at a mitre. Pure maths: three.js turns the rings into
// triangles.

import type { EdgeFinish, Point } from '@/types/drawing';
import { isClockwise } from '../geometry';
import { removalFraction } from './edgeProfile';

/** Slices across the thickness, top face to underside (so this plus one rings). */
export const PROFILE_LEVELS = 16;

/** A mitre may stretch a corner at most this many times the inset it is making, so a very
 *  sharp corner cannot shoot a spike far outside the stone. */
const MITRE_LIMIT = 4;
const PARALLEL_EPSILON = 1e-9;

export interface Ring {
  heightMm: number;
  points: Point[];
}

interface Unit {
  x: number;
  y: number;
}

/** Unit vector of the segment a -> b, or null for a zero-length one. */
function direction(a: Point, b: Point): Unit | null {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  return length === 0 ? null : { x: (b.x - a.x) / length, y: (b.y - a.y) / length };
}

/** Where a corner goes when its two sides are pulled in by `inPrev` and `inNext`. */
function insetCorner(corner: Point, prev: Unit, next: Unit, inPrev: number, inNext: number, inwardSign: 1 | -1): Point {
  // Inward normals: to the right of travel for a clockwise outline (y-up), to the left otherwise.
  const np = { x: prev.y * inwardSign, y: -prev.x * inwardSign };
  const nn = { x: next.y * inwardSign, y: -next.x * inwardSign };
  const det = np.x * nn.y - np.y * nn.x;
  let dx: number;
  let dy: number;
  if (Math.abs(det) < PARALLEL_EPSILON) {
    // Two sides running the same way: split the difference.
    const d = (inPrev + inNext) / 2;
    dx = np.x * d;
    dy = np.y * d;
  } else {
    // The offset point q satisfies q . np = inPrev and q . nn = inNext.
    dx = (inPrev * nn.y - inNext * np.y) / det;
    dy = (np.x * inNext - nn.x * inPrev) / det;
  }
  const reach = Math.hypot(dx, dy);
  const limit = MITRE_LIMIT * Math.max(inPrev, inNext);
  const scale = reach > limit && reach > 0 ? limit / reach : 1;
  return { x: corner.x + dx * scale, y: corner.y + dy * scale };
}

/** `outline` (any winding) as rings, top face first. `finishes[i]` is the finish of the side
 *  that runs from outline[i] to outline[i + 1]. */
export function profileRings(outline: Point[], finishes: EdgeFinish[], thicknessMm: number): Ring[] {
  const n = outline.length;
  const inwardSign = isClockwise(outline) ? 1 : -1;
  const dirs = outline.map((p, i) => direction(p, outline[(i + 1) % n]));
  const rings: Ring[] = [];

  for (let level = 0; level <= PROFILE_LEVELS; level += 1) {
    const t = level / PROFILE_LEVELS;
    const insets = finishes.map((f) => removalFraction(f, t) * thicknessMm);
    const points = outline.map((corner, i) => {
      const prevIndex = (i - 1 + n) % n;
      const prev = dirs[prevIndex];
      const next = dirs[i];
      if (!prev || !next) return corner;
      return insetCorner(corner, prev, next, insets[prevIndex], insets[i], inwardSign);
    });
    rings.push({ heightMm: thicknessMm * (1 - t), points });
  }
  return rings;
}
