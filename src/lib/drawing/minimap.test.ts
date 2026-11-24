import { describe, expect, it } from 'vitest';
import type { Piece } from '@/types/drawing';
import {
  boxToWorld, fitExtent, mapExtent, padRect, piecesBounds, rectCenter, rectContains, unionRects, viewportRect,
} from './minimap';

function piece(overrides: Partial<Piece> = {}): Piece {
  return {
    id: 'p', label: 'A-1', shape: 'rect',
    outline: [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -400 }, { x: 0, y: -400 }],
    position: { x: 0, y: 0 }, rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
    ...overrides,
  };
}

describe('viewportRect', () => {
  it.each([
    {
      name: 'an 800x600 canvas at 100% shows 800x600mm around the origin',
      pan: { x: 0, y: 0 }, zoom: 1, w: 800, h: 600,
      expected: { minX: -400, maxX: 400, minY: -300, maxY: 300 },
    },
    {
      name: 'zooming to 200% halves what is visible',
      pan: { x: 0, y: 0 }, zoom: 2, w: 800, h: 600,
      expected: { minX: -200, maxX: 200, minY: -150, maxY: 150 },
    },
    {
      name: 'panning moves the view the opposite way, with y flipped',
      pan: { x: -600, y: -200 }, zoom: 1, w: 800, h: 600,
      expected: { minX: 200, maxX: 1000, minY: -500, maxY: 100 },
    },
    {
      name: 'a canvas twice as wide shows twice the width at the same height',
      pan: { x: 0, y: 0 }, zoom: 1, w: 1600, h: 600,
      expected: { minX: -800, maxX: 800, minY: -300, maxY: 300 },
    },
  ])('$name', ({ pan, zoom, w, h, expected }) => {
    const rect = viewportRect(pan, zoom, w, h);
    expect(rect.minX).toBeCloseTo(expected.minX, 6);
    expect(rect.maxX).toBeCloseTo(expected.maxX, 6);
    expect(rect.minY).toBeCloseTo(expected.minY, 6);
    expect(rect.maxY).toBeCloseTo(expected.maxY, 6);
  });
});

describe('piecesBounds', () => {
  it('is null for a drawing with no pieces', () => {
    expect(piecesBounds([])).toBeNull();
  });

  it('covers every piece, in world coordinates', () => {
    const bounds = piecesBounds([piece(), piece({ id: 'q', position: { x: 1000, y: 200 } })]);
    expect(bounds).toEqual({ minX: 0, maxX: 1600, minY: -400, maxY: 200 });
  });

  it('follows a rotated piece', () => {
    // A quarter turn swaps a 600x400 piece to 400 wide by 600 tall.
    const bounds = piecesBounds([piece({ rotationDeg: 90 })]);
    expect((bounds?.maxX ?? 0) - (bounds?.minX ?? 0)).toBeCloseTo(400, 6);
    expect((bounds?.maxY ?? 0) - (bounds?.minY ?? 0)).toBeCloseTo(600, 6);
  });
});

describe('mapExtent', () => {
  const view = { minX: -400, maxX: 400, minY: -300, maxY: 300 };

  it('always holds the view, even when the drawing is far away from it', () => {
    const drawing = { minX: 5000, maxX: 5600, minY: 0, maxY: 400 };
    const extent = mapExtent(drawing, view);
    expect(extent.minX).toBeLessThanOrEqual(view.minX);
    expect(extent.maxX).toBeGreaterThanOrEqual(drawing.maxX);
  });

  it('with nothing drawn shows the view with padding', () => {
    expect(mapExtent(null, view)).toEqual(padRect(view));
  });

  it('pads by a tenth of the larger side, never less than 100mm', () => {
    expect(padRect({ minX: 0, maxX: 2000, minY: 0, maxY: 500 })).toEqual({ minX: -200, maxX: 2200, minY: -200, maxY: 700 });
    expect(padRect({ minX: 0, maxX: 0, minY: 0, maxY: 0 })).toEqual({ minX: -100, maxX: 100, minY: -100, maxY: 100 });
  });
});

describe('fitExtent and boxToWorld', () => {
  const extent = { minX: -500, maxX: 700, minY: -500, maxY: 400 }; // 1200 x 900

  it('scales uniformly to the tighter side and centres the other', () => {
    const fit = fitExtent(extent, 176, 112);
    expect(fit.scale).toBeCloseTo(112 / 900, 9);
    expect(fit.offsetY).toBeCloseTo(0, 9);
    expect(fit.offsetX).toBeCloseTo((176 - 1200 * fit.scale) / 2, 9);
  });

  it.each([
    { name: 'the box centre is the extent centre', x: 88, y: 56, expected: { x: 100, y: -50 } },
    { name: 'the top-left of the drawn area is the extent top-left', x: -1, y: 0, expected: null },
  ])('$name', ({ x, y, expected }) => {
    const fit = fitExtent(extent, 176, 112);
    const world = boxToWorld(x, y, fit);
    if (expected) {
      expect(world.x).toBeCloseTo(expected.x, 6);
      expect(world.y).toBeCloseTo(expected.y, 6);
    } else {
      // y grows downward in the box and upward in the drawing.
      expect(world.y).toBeCloseTo(extent.maxY, 6);
    }
  });

  it('moving down the box moves down the drawing', () => {
    const fit = fitExtent(extent, 176, 112);
    expect(boxToWorld(88, 80, fit).y).toBeLessThan(boxToWorld(88, 20, fit).y);
  });
});

describe('rect helpers', () => {
  it('rectCenter is the middle', () => {
    expect(rectCenter({ minX: 0, maxX: 10, minY: -4, maxY: 4 })).toEqual({ x: 5, y: 0 });
  });

  it('rectContains includes the edges and excludes outside points', () => {
    const rect = { minX: 0, maxX: 10, minY: 0, maxY: 10 };
    expect(rectContains(rect, { x: 10, y: 0 })).toBe(true);
    expect(rectContains(rect, { x: 10.1, y: 5 })).toBe(false);
  });

  it('unionRects spans both', () => {
    expect(unionRects({ minX: 0, maxX: 1, minY: 0, maxY: 1 }, { minX: -2, maxX: 0.5, minY: 3, maxY: 4 }))
      .toEqual({ minX: -2, maxX: 1, minY: 0, maxY: 4 });
  });
});
