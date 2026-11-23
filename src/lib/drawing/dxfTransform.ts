// 2D affine transforms and curve flattening for placing DXF geometry.
// Everything curved becomes points so one transform path covers every entity,
// including non-uniformly scaled blocks where a circle is no longer a circle.

export type Pt = { x: number; y: number };

/** x' = a·x + c·y + e, y' = b·x + d·y + f */
export type Matrix = { a: number; b: number; c: number; d: number; e: number; f: number };

export const IDENTITY: Matrix = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
/** How a DXF stores geometry extruded along -Z: mirrored across the Y axis. */
export const MIRROR_X: Matrix = { a: -1, b: 0, c: 0, d: 1, e: 0, f: 0 };

const FULL_TURN = 2 * Math.PI;
/** Finest step along a curve; at a 20" radius the error is under 1/64". */
const MAX_ARC_STEP_RAD = Math.PI / 60;
const STRAIGHT_BULGE_EPSILON = 1e-9;

export function multiply(m: Matrix, n: Matrix): Matrix {
  return {
    a: m.a * n.a + m.c * n.b,
    b: m.b * n.a + m.d * n.b,
    c: m.a * n.c + m.c * n.d,
    d: m.b * n.c + m.d * n.d,
    e: m.a * n.e + m.c * n.f + m.e,
    f: m.b * n.e + m.d * n.f + m.f,
  };
}

export function translation(x: number, y: number): Matrix {
  return { ...IDENTITY, e: x, f: y };
}

export function rotation(deg: number): Matrix {
  const rad = (deg * Math.PI) / 180;
  return { a: Math.cos(rad), b: Math.sin(rad), c: -Math.sin(rad), d: Math.cos(rad), e: 0, f: 0 };
}

export function scaling(x: number, y: number): Matrix {
  return { ...IDENTITY, a: x, d: y };
}

export function applyMatrix(m: Matrix, p: Pt): Pt {
  return { x: m.a * p.x + m.c * p.y + m.e, y: m.b * p.x + m.d * p.y + m.f };
}

export function matrixScale(m: Matrix): number {
  return Math.hypot(m.a, m.b);
}

export function matrixRotationDeg(m: Matrix): number {
  return (Math.atan2(m.b, m.a) * 180) / Math.PI;
}

/** Points along a circular arc, inclusive of both ends. `sweep` is signed: positive is CCW. */
function arcPoints(center: Pt, radius: number, start: number, sweep: number): Pt[] {
  const steps = Math.max(1, Math.ceil(Math.abs(sweep) / MAX_ARC_STEP_RAD));
  const points: Pt[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = start + (sweep * i) / steps;
    points.push({ x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) });
  }
  return points;
}

/** An ARC entity, always CCW from start to end; equal angles mean a full turn. */
export function flattenArc(center: Pt, radius: number, startRad: number, endRad: number): Pt[] {
  const sweep = (endRad - startRad + FULL_TURN) % FULL_TURN;
  return arcPoints(center, radius, startRad, sweep === 0 ? FULL_TURN : sweep);
}

export function flattenCircle(center: Pt, radius: number): Pt[] {
  return arcPoints(center, radius, 0, FULL_TURN);
}

/** A polyline's vertices with each bulged segment turned into an arc. A vertex's
 *  bulge shapes the segment leaving it: tan(sweep / 4), positive bowing to the
 *  right of travel. The result does not repeat the first point when `closed`
 *  unless the closing segment itself bulges. `spend` hears of points as they're
 *  made, and may throw: a file can pack in enough bulges to exhaust memory. */
export function flattenBulges(
  vertices: ReadonlyArray<Pt & { bulge?: number }>,
  closed: boolean,
  spend: (points: number) => void,
): Pt[] {
  const out: Pt[] = [];
  const segmentCount = closed ? vertices.length : vertices.length - 1;
  if (vertices.length > 0) {
    spend(1);
    out.push(vertices[0]);
  }
  for (let i = 0; i < segmentCount; i += 1) {
    const from = vertices[i];
    const to = vertices[(i + 1) % vertices.length];
    const bulge = from.bulge ?? 0;
    const isClosingSegment = i === vertices.length - 1;
    if (Math.abs(bulge) >= STRAIGHT_BULGE_EPSILON) {
      const arc = bulgeArc(from, to, bulge).slice(1);
      spend(arc.length);
      for (const point of arc) out.push(point);
    } else if (!isClosingSegment) {
      spend(1);
      out.push(to);
    }
  }
  return out;
}

function bulgeArc(from: Pt, to: Pt, bulge: number): Pt[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const chord = Math.hypot(dx, dy);
  if (chord === 0) return [from];
  const centerOffset = ((chord / 2) * (1 - bulge * bulge)) / (2 * bulge);
  const center = {
    x: (from.x + to.x) / 2 - (centerOffset * dy) / chord,
    y: (from.y + to.y) / 2 + (centerOffset * dx) / chord,
  };
  const radius = (chord * (1 + bulge * bulge)) / (4 * Math.abs(bulge));
  const start = Math.atan2(from.y - center.y, from.x - center.x);
  return arcPoints(center, radius, start, 4 * Math.atan(bulge));
}
