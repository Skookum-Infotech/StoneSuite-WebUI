import { describe, expect, it } from 'vitest';
import type { Cutout, CutoutType } from '@/types/drawing';
import { CUTOUT_EDGE_CLEARANCE_MM } from './constants';
import { rectOutline } from './geometry';
import {
  CUTOUT_DEFAULTS, CUTOUT_TYPES, centerFromBoundsMm, centerFromOffsets, convertCutoutShape, cutoutArea,
  cutoutOutline, cutoutPatchProblem, cutoutShape,
  newCutout, validateCutouts,
} from './cutouts';

const slab = rectOutline(2000, 800);
const sink = (id: string, x: number, y: number, extra: Partial<Cutout> = {}): Cutout => ({
  id, type: 'sink', shape: 'rect', center: { x, y }, widthMm: 600, depthMm: 400, ...extra,
});

describe('cutoutShape', () => {
  it.each([
    [{ shape: 'round' as const }, 'round'],
    [{ outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] }, 'polygon'],
    [{ diameterMm: 35 }, 'round'],
    [{ widthMm: 100, depthMm: 100 }, 'rect'],
    [{}, 'rect'],
  ])('%j -> %s', (extra, expected) => {
    expect(cutoutShape({ id: 'c', type: 'custom', center: { x: 0, y: 0 }, ...extra })).toBe(expected);
  });
});

describe('cutoutOutline / cutoutArea', () => {
  it('builds a rectangle of the stated size around the centre', () => {
    const outline = cutoutOutline(sink('s', 1000, -400));
    expect(outline).toHaveLength(4);
    expect(cutoutArea(sink('s', 1000, -400))).toBeCloseTo(600 * 400);
  });

  it('rotating a rectangle 90 degrees swaps its extents but not its area', () => {
    const rotated = cutoutOutline(sink('s', 1000, -400, { rotationDeg: 90 }));
    const xs = rotated.map((p) => p.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(400);
    expect(cutoutArea(sink('s', 1000, -400, { rotationDeg: 90 }))).toBeCloseTo(600 * 400);
  });

  it('approximates a circle closely enough that its area is within 1% of pi r squared', () => {
    const faucet: Cutout = { id: 'f', type: 'faucet', shape: 'round', center: { x: 0, y: 0 }, diameterMm: 100 };
    expect(cutoutArea(faucet) / (Math.PI * 50 * 50)).toBeGreaterThan(0.99);
  });

  it('uses custom geometry relative to the centre', () => {
    const custom: Cutout = {
      id: 'c', type: 'custom', shape: 'polygon', center: { x: 500, y: -300 },
      outline: [{ x: -50, y: 50 }, { x: 50, y: 50 }, { x: 50, y: -50 }, { x: -50, y: -50 }],
    };
    expect(cutoutOutline(custom)[0]).toEqual({ x: 450, y: -250 });
    expect(cutoutArea(custom)).toBeCloseTo(10000);
  });

  it('returns nothing for a cutout with no size', () => {
    expect(cutoutOutline({ id: 'x', type: 'sink', shape: 'rect', center: { x: 0, y: 0 } })).toEqual([]);
    expect(cutoutArea({ id: 'x', type: 'faucet', shape: 'round', center: { x: 0, y: 0 } })).toBe(0);
  });
});

describe('newCutout', () => {
  it.each(CUTOUT_TYPES)('%s starts at its default size, at the given centre', (type: CutoutType) => {
    const c = newCutout('id', type, { x: 5, y: -5 });
    expect(c.center).toEqual({ x: 5, y: -5 });
    expect(c.shape).toBe(CUTOUT_DEFAULTS[type].shape);
    expect(cutoutArea(c)).toBeGreaterThan(0);
  });
});

describe('validateCutouts', () => {
  it('accepts cutouts well inside the piece and apart from each other', () => {
    expect(validateCutouts({ outline: slab, cutouts: [sink('a', 600, -400), sink('b', 1400, -400)] })).toEqual([]);
  });

  it('rejects a cutout that pokes through the piece edge', () => {
    const issues = validateCutouts({ outline: slab, cutouts: [sink('a', 100, -400)] });
    expect(issues).toHaveLength(1);
    expect(issues[0].cutoutId).toBe('a');
    expect(issues[0].message).toContain('fully inside');
  });

  it('rejects a cutout closer to the edge than the clearance, accepts one exactly at it', () => {
    const tooClose = sink('a', 300 + CUTOUT_EDGE_CLEARANCE_MM - 1, -400);
    const ok = sink('b', 300 + CUTOUT_EDGE_CLEARANCE_MM + 1, -400);
    expect(validateCutouts({ outline: slab, cutouts: [tooClose] })).toHaveLength(1);
    expect(validateCutouts({ outline: slab, cutouts: [ok] })).toEqual([]);
  });

  it('rejects a cutout sitting in the notch of an L-shaped piece', () => {
    const l = [
      { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: -400 }, { x: 2000, y: -400 }, { x: 2000, y: -800 }, { x: 0, y: -800 },
    ];
    const issues = validateCutouts({ outline: l, cutouts: [sink('a', 1500, -200, { widthMm: 200, depthMm: 100 })] });
    expect(issues).toHaveLength(1);
  });

  it('rejects two cutouts that overlap, and names the later one', () => {
    const issues = validateCutouts({ outline: slab, cutouts: [sink('a', 800, -400), sink('b', 1000, -400)] });
    expect(issues.map((i) => i.cutoutId)).toEqual(['b']);
    expect(issues[0].message).toContain('overlaps');
  });

  it('rejects two cutouts nearly touching, but not ones with enough stone between', () => {
    const near = validateCutouts({ outline: slab, cutouts: [sink('a', 600, -400), sink('b', 1201, -400)] });
    const apart = validateCutouts({ outline: slab, cutouts: [sink('a', 600, -400), sink('b', 1300, -400)] });
    expect(near).toHaveLength(1);
    expect(apart).toEqual([]);
  });

  it('rejects a cutout with no size', () => {
    const issues = validateCutouts({ outline: slab, cutouts: [{ id: 'x', type: 'sink', shape: 'rect', center: { x: 600, y: -400 } }] });
    expect(issues[0].message).toContain('above zero');
  });
});

describe('centre offsets', () => {
  it('round-trips between local coordinates and distance from the left/top edges', () => {
    const offsets = centerFromBoundsMm({ outline: slab }, { x: 500, y: -250 });
    expect(offsets).toEqual({ fromLeft: 500, fromTop: 250 });
    expect(centerFromOffsets({ outline: slab }, offsets.fromLeft, offsets.fromTop)).toEqual({ x: 500, y: -250 });
  });
});

describe('cutoutPatchProblem', () => {
  const piece = { outline: slab, cutouts: [sink('a', 600, -400), sink('b', 1400, -400)] };

  it('is null for a change that still fits', () => {
    expect(cutoutPatchProblem(piece, piece.cutouts[0], { widthMm: 700 })).toBeNull();
  });

  it('names the problem when the change pushes the cutout into its neighbour', () => {
    expect(cutoutPatchProblem(piece, piece.cutouts[0], { widthMm: 1100 })).toContain('overlaps');
  });

  it('flags a move that takes a cutout off the piece', () => {
    expect(cutoutPatchProblem(piece, piece.cutouts[1], { center: { x: 5000, y: -400 } })).toContain('fully inside');
  });
});

describe('convertCutoutShape', () => {
  it('does nothing when the shape is unchanged', () => {
    expect(convertCutoutShape(sink('a', 0, 0), 'rect')).toEqual({});
  });

  it('turns a rectangle into the round opening of its longer side, and a circle into a square', () => {
    expect(convertCutoutShape(sink('a', 0, 0), 'round')).toEqual({ shape: 'round', diameterMm: 600 });
    const round: Cutout = { id: 'f', type: 'faucet', shape: 'round', center: { x: 0, y: 0 }, diameterMm: 40 };
    expect(convertCutoutShape(round, 'rect')).toEqual({ shape: 'rect', widthMm: 40, depthMm: 40 });
  });

  it('turns either into custom geometry covering the same area', () => {
    const patch = convertCutoutShape(sink('a', 0, 0), 'polygon');
    expect(patch.shape).toBe('polygon');
    expect(cutoutArea({ ...sink('a', 0, 0), ...patch })).toBeCloseTo(600 * 400);
  });
});
