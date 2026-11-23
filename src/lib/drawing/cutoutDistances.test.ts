import { describe, expect, it } from 'vitest';
import type { Cutout, DistanceLines } from '@/types/drawing';
import { cutoutDistances } from './cutoutDistances';

// 1000 wide x 600 deep, top-left at the origin (y up, so the body runs to -600).
const PIECE = { outline: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: -600 }, { x: 0, y: -600 }] };

const lines = (change: Partial<DistanceLines> = {}): DistanceLines => ({
  top: 'hidden', right: 'hidden', bottom: 'hidden', left: 'hidden', ...change,
});

const cutout = (distanceLines?: DistanceLines): Cutout => ({
  id: 'c', type: 'sink', shape: 'rect', center: { x: 400, y: -200 }, widthMm: 200, depthMm: 100, distanceLines,
});

describe('cutoutDistances', () => {
  it('has none without distance lines, or with every side hidden', () => {
    expect(cutoutDistances(PIECE, cutout())).toEqual([]);
    expect(cutoutDistances(PIECE, cutout(lines()))).toEqual([]);
  });

  it('measures from the centre out to each edge', () => {
    const found = cutoutDistances(PIECE, cutout(lines({ left: 'center', top: 'center', right: 'center', bottom: 'center' })));
    const byLength = Object.fromEntries(found.map((d) => [d.side, d.lengthMm]));
    expect(byLength).toEqual({ left: 400, right: 600, top: 200, bottom: 400 });
  });

  it('measures from the border when asked, ending on the edge', () => {
    const [left] = cutoutDistances(PIECE, cutout(lines({ left: 'border' })));
    expect(left.from).toEqual({ x: 300, y: -200 });
    expect(left.to).toEqual({ x: 0, y: -200 });
    expect(left.lengthMm).toBe(300);
    const [bottom] = cutoutDistances(PIECE, cutout(lines({ bottom: 'border' })));
    expect(bottom.lengthMm).toBe(350);
  });

  it('finds the nearest edge of an L-shaped piece, not the bounding box', () => {
    // An L: the top-right 500 x 300 corner is missing.
    const l = { outline: [
      { x: 0, y: 0 }, { x: 500, y: 0 }, { x: 500, y: -300 }, { x: 1000, y: -300 },
      { x: 1000, y: -600 }, { x: 0, y: -600 },
    ] };
    const sink: Cutout = { ...cutout(lines({ right: 'center', top: 'center' })), center: { x: 700, y: -450 } };
    const byLength = Object.fromEntries(cutoutDistances(l, sink).map((d) => [d.side, d.lengthMm]));
    expect(byLength).toEqual({ right: 300, top: 150 });
  });

  it('skips a side that has no piece edge to measure to', () => {
    const outside: Cutout = { ...cutout(lines({ left: 'center' })), center: { x: -50, y: -200 } };
    expect(cutoutDistances(PIECE, outside)).toEqual([]);
  });
});
