import { describe, expect, it } from 'vitest';
import type { DrawingArea, Piece, Point } from '@/types/drawing';
import { rectOutline } from './geometry';
import { snapAnnotationPoint, snapGeometry } from './annotationSnap';

// A 1000 x 500 top: x 0..1000, y 0 down to -500 (world is y-up, so the top side is y = 0).
const TOL = 20;

function piece(patch: Partial<Piece> = {}): Piece {
  return {
    id: 'p1', label: 'A-1', shape: 'rect', outline: rectOutline(1000, 500), position: { x: 0, y: 0 },
    rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [], ...patch,
  };
}

const geometryOf = (...pieces: Piece[]) => snapGeometry({ pieces } as Pick<DrawingArea, 'pieces'>);
const at = (x: number, y: number): Point => ({ x, y });

describe('snapAnnotationPoint — first point', () => {
  const geometry = geometryOf(piece());

  it('pulls onto a corner within reach, and keeps the side it sits on', () => {
    const snap = snapAnnotationPoint(at(8, -6), geometry, TOL);
    expect(snap).toMatchObject({ kind: 'corner', point: at(0, 0) });
    expect(snap.side).toBeDefined();
  });

  it('prefers the corner over the border beside it', () => {
    expect(snapAnnotationPoint(at(1000 - 5, -3), geometry, TOL).kind).toBe('corner');
  });

  it('pulls onto the nearest spot of a border within reach', () => {
    const snap = snapAnnotationPoint(at(400, -14), geometry, TOL);
    expect(snap.kind).toBe('edge');
    expect(snap.point.x).toBeCloseTo(400);
    expect(snap.point.y).toBeCloseTo(0);
    expect(snap.side).toEqual([at(0, 0), at(1000, 0)]);
  });

  it('works from outside the piece too', () => {
    const snap = snapAnnotationPoint(at(400, 12), geometry, TOL);
    expect(snap.kind).toBe('edge');
    expect(snap.point.y).toBeCloseTo(0);
  });

  it('leaves a point alone when nothing is close', () => {
    expect(snapAnnotationPoint(at(400, -250), geometry, TOL)).toEqual({ point: at(400, -250), kind: 'free' });
  });

  it('reaches further when the tolerance does (zoomed out)', () => {
    expect(snapAnnotationPoint(at(400, -90), geometry, TOL).kind).toBe('free');
    expect(snapAnnotationPoint(at(400, -90), geometry, 100).kind).toBe('edge');
  });
});

describe('snapAnnotationPoint — second point, straight across', () => {
  const geometry = geometryOf(piece());
  const from = { point: at(300, 0), side: [at(0, 0), at(1000, 0)] as [Point, Point] };

  it('runs square across to the far border even when the pointer is some way off its line', () => {
    // Started on the top side; the pointer is near the bottom side but 15 mm to the right of straight down.
    const snap = snapAnnotationPoint(at(315, -490), geometry, TOL, from);
    expect(snap.kind).toBe('across');
    expect(snap.point.x).toBeCloseTo(300);
    expect(snap.point.y).toBeCloseTo(-500);
  });

  it('runs straight across a horizontal way from a point on a side', () => {
    const snap = snapAnnotationPoint(at(985, -245), geometry, TOL, { point: at(0, -250), side: [at(0, -500), at(0, 0)] });
    expect(snap).toMatchObject({ kind: 'across' });
    expect(snap.point.x).toBeCloseTo(1000);
    expect(snap.point.y).toBeCloseTo(-250);
  });

  it('squares up to a side that is not horizontal or vertical', () => {
    // A top turned 30 degrees: a seam started on one long side runs at right angles to it.
    const turned = geometryOf(piece({ rotationDeg: 30 }));
    const start = turned.outlines[0][0]; // a corner of the turned top
    const [a, b] = [turned.outlines[0][0], turned.outlines[0][1]];
    const length = Math.hypot(b.x - a.x, b.y - a.y);
    const normal = { x: -(b.y - a.y) / length, y: (b.x - a.x) / length };
    // Walk 250 mm along the side, then 500 mm across (clockwise outline: the piece lies to the right).
    const side: [Point, Point] = [a, b];
    const begin = { x: start.x + ((b.x - a.x) / length) * 250, y: start.y + ((b.y - a.y) / length) * 250 };
    const target = { x: begin.x - normal.x * 500, y: begin.y - normal.y * 500 };
    const nearTarget = { x: target.x + 8, y: target.y + 6 };
    const snap = snapAnnotationPoint(nearTarget, turned, TOL, { point: begin, side });
    expect(snap.kind).toBe('across');
    expect(snap.point.x).toBeCloseTo(target.x, 3);
    expect(snap.point.y).toBeCloseTo(target.y, 3);
  });

  it('does not snap "across" to the border the line started on', () => {
    // Pointer near the start's own side: that is just the edge snap, not a zero-length line.
    expect(snapAnnotationPoint(at(310, -10), geometry, TOL, from).kind).toBe('edge');
  });

  it('prefers a corner to a straight-across spot', () => {
    expect(snapAnnotationPoint(at(995, -495), geometry, TOL, { point: at(1000, 0), side: [at(0, 0), at(1000, 0)] }).kind).toBe('corner');
  });

  it('falls back to the nearest border point when no straight line is close', () => {
    const snap = snapAnnotationPoint(at(700, -490), geometry, TOL, from);
    expect(snap.kind).toBe('edge');
    expect(snap.point.x).toBeCloseTo(700);
    expect(snap.point.y).toBeCloseTo(-500);
  });

  it('leaves a point inside the piece alone', () => {
    expect(snapAnnotationPoint(at(600, -250), geometry, TOL, from).kind).toBe('free');
  });
});

describe('snapGeometry', () => {
  it('puts corners and borders where the piece sits', () => {
    const geometry = geometryOf(piece({ position: { x: 100, y: 200 } }));
    expect(geometry.corners).toContainEqual(at(100, 200));
    expect(geometry.outlines[0]).toContainEqual(at(1100, -300));
  });

  it('follows a curved side along its curve', () => {
    const flat = geometryOf(piece());
    const bowed = geometryOf(piece({ edges: [{ index: 0, arcHeightMm: 100 }] }));
    expect(bowed.outlines[0].length).toBeGreaterThan(flat.outlines[0].length);
    // Corners stay the piece's own four; the flattened curve is not a set of magnets.
    expect(bowed.corners).toHaveLength(4);
  });
});
