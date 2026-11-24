import { describe, expect, it } from 'vitest';
import {
  area, bounds, circleOutline, isClockwise, lShapeOutline, outlineEdges, perimeter, rectOutline,
  snapToGrid, squareFeet, transformOutline, uShapeOutline,
} from './geometry';

describe('rectOutline', () => {
  it('returns 4 clockwise corners starting at the origin', () => {
    expect(rectOutline(600, 400)).toEqual([
      { x: 0, y: 0 },
      { x: 600, y: 0 },
      { x: 600, y: -400 },
      { x: 0, y: -400 },
    ]);
  });
});

describe('circleOutline', () => {
  it('returns a regular polygon of the given radius and segment count, centred on the origin', () => {
    const outline = circleOutline(100, 8);
    expect(outline).toHaveLength(8);
    outline.forEach((p) => expect(Math.hypot(p.x, p.y)).toBeCloseTo(100));
    // First point sits on the +X axis.
    expect(outline[0].x).toBeCloseTo(100);
    expect(outline[0].y).toBeCloseTo(0);
  });

  it('winds clockwise, like rectOutline', () => {
    expect(isClockwise(circleOutline(100, 8))).toBe(true);
  });

  it('closely approximates a circle\'s true area at the default segment count', () => {
    const r = 100;
    const exact = Math.PI * r * r;
    const relativeError = Math.abs(area(circleOutline(r)) - exact) / exact;
    expect(relativeError).toBeLessThan(0.01);
  });

  it('defaults to ROUND_CUTOUT_SEGMENTS points when none is given', () => {
    expect(circleOutline(100)).toHaveLength(48);
  });
});

describe('outlineEdges', () => {
  it('pairs each point with the next, closing back to the first', () => {
    const outline = rectOutline(600, 400);
    expect(outlineEdges(outline)).toEqual([
      [outline[0], outline[1]],
      [outline[1], outline[2]],
      [outline[2], outline[3]],
      [outline[3], outline[0]],
    ]);
  });
});

describe('perimeter', () => {
  it.each([
    [600, 400, 2000],
    [1000, 1000, 4000],
  ])('sums a %s x %s rect to %smm', (length, width, expected) => {
    expect(perimeter(rectOutline(length, width))).toBeCloseTo(expected, 5);
  });
});

describe('area', () => {
  it.each([
    [600, 400, 240000],
    [1000, 1000, 1000000],
  ])('computes a %s x %s rect as %smm^2', (length, width, expected) => {
    expect(area(rectOutline(length, width))).toBeCloseTo(expected, 5);
  });

  it('is unaffected by winding direction', () => {
    const clockwise = rectOutline(600, 400);
    const counterClockwise = [...clockwise].reverse();
    expect(area(counterClockwise)).toBeCloseTo(area(clockwise), 5);
  });

  it.each([
    [[{ x: 0, y: 0 }]],
    [[{ x: 0, y: 0 }, { x: 10, y: 0 }]],
  ])('is zero for a degenerate outline %j', (outline) => {
    expect(area(outline)).toBe(0);
  });
});

describe('squareFeet', () => {
  it('converts a 10ft x 2ft slab (in mm) to 20 sq ft', () => {
    const FT_TO_MM = 304.8;
    expect(squareFeet(rectOutline(10 * FT_TO_MM, 2 * FT_TO_MM))).toBeCloseTo(20, 3);
  });
});

describe('bounds', () => {
  it('returns the axis-aligned box for a rect', () => {
    expect(bounds(rectOutline(600, 400))).toEqual({ minX: 0, minY: -400, maxX: 600, maxY: 0 });
  });
});

describe('lShapeOutline', () => {
  it('returns a 6-point clockwise outline with the notch cut from the top-right corner', () => {
    expect(lShapeOutline(1000, 600, 400, 300)).toEqual([
      { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -300 },
      { x: 1000, y: -300 }, { x: 1000, y: -600 }, { x: 0, y: -600 },
    ]);
  });
});

describe('uShapeOutline', () => {
  it('returns an 8-point clockwise outline with a centered notch in the top edge', () => {
    expect(uShapeOutline(1200, 600, 400, 350)).toEqual([
      { x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: -350 }, { x: 800, y: -350 },
      { x: 800, y: 0 }, { x: 1200, y: 0 }, { x: 1200, y: -600 }, { x: 0, y: -600 },
    ]);
  });
});

describe('snapToGrid', () => {
  it.each([
    [{ x: 10, y: 10 }, 25.4, { x: 0, y: 0 }],
    [{ x: 15, y: 10 }, 25.4, { x: 25.4, y: 0 }],
    [{ x: -10, y: -20 }, 25.4, { x: 0, y: -25.4 }],
    [{ x: 50.8, y: 25.4 }, 25.4, { x: 50.8, y: 25.4 }],
  ])('snaps %j at grid %s to %j', (point, gridSizeMm, expected) => {
    const snapped = snapToGrid(point, gridSizeMm);
    expect(snapped.x).toBeCloseTo(expected.x, 5);
    expect(snapped.y).toBeCloseTo(expected.y, 5);
  });
});

describe('isClockwise', () => {
  it('is true for rectOutline\'s own winding (the convention every dimension/export helper assumes)', () => {
    expect(isClockwise(rectOutline(600, 400))).toBe(true);
  });

  it('is false for the same outline reversed', () => {
    expect(isClockwise([...rectOutline(600, 400)].reverse())).toBe(false);
  });

  it('is true for a hand-clicked polygon going the same direction as rectOutline', () => {
    // A right turn at every vertex, same as rectOutline's own corners.
    expect(isClockwise([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: -10 }, { x: 0, y: -10 }])).toBe(true);
  });
});

describe('transformOutline', () => {
  it.each([
    [0 as const, { x: 600, y: 0 }, { x: 610, y: 5 }],
    [90 as const, { x: 600, y: 0 }, { x: 10, y: -595 }],
    [180 as const, { x: 600, y: 0 }, { x: -590, y: 5 }],
    [270 as const, { x: 600, y: 0 }, { x: 10, y: 605 }],
  ])('rotates %s° clockwise about the origin, then translates by position', (rotationDeg, localPoint, expected) => {
    const [result] = transformOutline([localPoint], { x: 10, y: 5 }, rotationDeg);
    expect(result.x).toBeCloseTo(expected.x, 5);
    expect(result.y).toBeCloseTo(expected.y, 5);
  });
});
