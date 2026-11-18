import { describe, expect, it } from 'vitest';
import type { Cutout, CutoutShape } from '@/types/drawing';
import { MM_PER_INCH, ROUND_CUTOUT_SEGMENTS } from './constants';
import { convertCutoutShape, cutoutArea, cutoutOutline, cutoutShape, isBoxShape, validateCutouts } from './cutouts';
import { bounds, isClockwise } from './geometry';

const W = 800;
const H = 400;

const cutout = (shape: CutoutShape, change: Partial<Cutout> = {}): Cutout => ({
  id: 'c', type: 'other', shape, center: { x: 1000, y: -500 }, widthMm: W, depthMm: H, ...change,
});

describe.each(['ellipse', 'arc', 'stadium'] as const)('a %s opening', (shape) => {
  it('fills its length x height box exactly, centred on the cutout', () => {
    const b = bounds(cutoutOutline(cutout(shape)));
    expect(b.minX).toBeCloseTo(1000 - W / 2, 6);
    expect(b.maxX).toBeCloseTo(1000 + W / 2, 6);
    expect(b.minY).toBeCloseTo(-500 - H / 2, 6);
    expect(b.maxY).toBeCloseTo(-500 + H / 2, 6);
  });

  it('is wound clockwise like every other outline, with no repeated points', () => {
    const outline = cutoutOutline(cutout(shape));
    expect(isClockwise(outline)).toBe(true);
    outline.forEach((p, i) => {
      const next = outline[(i + 1) % outline.length];
      expect(Math.hypot(next.x - p.x, next.y - p.y)).toBeGreaterThan(1e-9);
    });
  });

  it('is a box shape, sized by width and height', () => {
    expect(isBoxShape(shape)).toBe(true);
    expect(cutoutShape(cutout(shape))).toBe(shape);
  });

  it('has no outline without a size', () => {
    expect(cutoutOutline(cutout(shape, { widthMm: 0 }))).toEqual([]);
  });

  it('turns with the cutout', () => {
    const b = bounds(cutoutOutline(cutout(shape, { rotationDeg: 90 })));
    expect(b.maxX - b.minX).toBeCloseTo(H, 4);
    expect(b.maxY - b.minY).toBeCloseTo(W, 4);
  });
});

describe('opening areas', () => {
  it('an ellipse is pi/4 of its box, an arc a little less than the box, a stadium in between', () => {
    const box = W * H;
    expect(cutoutArea(cutout('ellipse')) / box).toBeCloseTo(Math.PI / 4, 1);
    const arc = cutoutArea(cutout('arc')) / box;
    const stadium = cutoutArea(cutout('stadium')) / box;
    expect(arc).toBeGreaterThan(Math.PI / 4);
    expect(arc).toBeLessThan(1);
    expect(stadium).toBeGreaterThan(Math.PI / 4);
    expect(stadium).toBeLessThan(1);
  });

  it('an arc is domed at the top and flat along the bottom', () => {
    const outline = cutoutOutline(cutout('arc'));
    const bottom = outline.filter((p) => Math.abs(p.y - (-500 - H / 2)) < 1e-6);
    expect(bottom).toHaveLength(2); // the two bottom corners, joined by a straight edge
    const top = outline.filter((p) => Math.abs(p.y - (-500 + H / 2)) < 1e-6);
    expect(top).toHaveLength(1); // one apex, not a flat roof
    expect(top[0].x).toBeCloseTo(1000, 6);
  });

  it('keeps the number of points to a small fixed count', () => {
    expect(cutoutOutline(cutout('ellipse'))).toHaveLength(ROUND_CUTOUT_SEGMENTS);
    expect(cutoutOutline(cutout('arc')).length).toBeLessThanOrEqual(ROUND_CUTOUT_SEGMENTS + 3);
  });
});

describe('placement rules follow the real outline', () => {
  const piece = { outline: [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: -1000 }, { x: 0, y: -1000 }] };

  it('an ellipse nestles beside a neighbour where its box would overlap it', () => {
    // Two 800 x 400 openings 100mm apart centre-to-centre in y: boxes overlap, ellipses at an offset do not.
    const a: Cutout = cutout('rect', { id: 'a', center: { x: 600, y: -300 } });
    const b: Cutout = cutout('ellipse', { id: 'b', center: { x: 1500, y: -700 } });
    expect(validateCutouts({ ...piece, cutouts: [a, b] })).toEqual([]);
  });

  it('refuses an opening whose outline crosses the piece edge', () => {
    const out: Cutout = cutout('arc', { center: { x: 300, y: -500 } });
    expect(validateCutouts({ ...piece, cutouts: [out] })).toHaveLength(1);
  });
});

describe('converting between shapes keeps the size', () => {
  it('rect to ellipse and back', () => {
    const toEllipse = convertCutoutShape(cutout('rect'), 'ellipse');
    expect(toEllipse).toMatchObject({ shape: 'ellipse', widthMm: W, depthMm: H });
    const back = convertCutoutShape({ ...cutout('rect'), ...toEllipse }, 'rect');
    expect(back).toMatchObject({ shape: 'rect', widthMm: W, depthMm: H });
  });

  it('round to arc gives a square box of its diameter, and clears the diameter', () => {
    const round: Cutout = { id: 'c', type: 'faucet', shape: 'round', center: { x: 0, y: 0 }, diameterMm: 35 };
    expect(convertCutoutShape(round, 'arc')).toMatchObject({ shape: 'arc', widthMm: 35, depthMm: 35, diameterMm: undefined });
  });

  it('is a no-op to the same shape', () => {
    expect(convertCutoutShape(cutout('arc'), 'arc')).toEqual({});
  });

  it('a 25.4mm-wide stadium is fine at the cap width, with no zero-length edges', () => {
    const outline = cutoutOutline(cutout('stadium', { widthMm: 2 * MM_PER_INCH, depthMm: 2 * MM_PER_INCH }));
    expect(outline.length).toBeGreaterThanOrEqual(ROUND_CUTOUT_SEGMENTS - 4);
  });
});
