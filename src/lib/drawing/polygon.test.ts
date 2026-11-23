import { describe, expect, it } from 'vitest';
import type { Point } from '@/types/drawing';
import { lShapeOutline, rectOutline } from './geometry';
import {
  boundaryDistance, distanceToSegment, interiorAngles, isSimplePolygon, pointInPolygon, polygonInside,
  polygonsOverlap, segmentsIntersect,
} from './polygon';

const square = (x: number, y: number, size: number): Point[] => [
  { x, y }, { x: x + size, y }, { x: x + size, y: y - size }, { x, y: y - size },
];

describe('segmentsIntersect', () => {
  it.each([
    ['crossing', [[0, 0], [10, 10]], [[0, 10], [10, 0]], true],
    ['parallel apart', [[0, 0], [10, 0]], [[0, 5], [10, 5]], false],
    ['touching at an endpoint', [[0, 0], [5, 5]], [[5, 5], [10, 0]], true],
    ['collinear overlapping', [[0, 0], [10, 0]], [[5, 0], [15, 0]], true],
    ['collinear apart', [[0, 0], [4, 0]], [[5, 0], [9, 0]], false],
    ['T junction', [[0, 0], [10, 0]], [[5, 0], [5, 5]], true],
    ['near miss', [[0, 0], [10, 0]], [[5, 1], [5, 5]], false],
  ] as const)('%s', (_name, a, b, expected) => {
    const seg = (s: readonly (readonly number[])[]) => [{ x: s[0][0], y: s[0][1] }, { x: s[1][0], y: s[1][1] }] as [Point, Point];
    expect(segmentsIntersect(seg(a), seg(b))).toBe(expected);
  });
});

describe('distanceToSegment', () => {
  it.each([
    [{ x: 5, y: 3 }, 3],
    [{ x: -4, y: 3 }, 5],
    [{ x: 5, y: 0 }, 0],
  ])('point %j is %d from the segment', (p, expected) => {
    expect(distanceToSegment(p, { x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(expected);
  });

  it('measures to the point when the segment has no length', () => {
    expect(distanceToSegment({ x: 3, y: 4 }, { x: 0, y: 0 }, { x: 0, y: 0 })).toBe(5);
  });
});

describe('pointInPolygon', () => {
  const l = lShapeOutline(1000, 600, 400, 300);
  it.each([
    [{ x: 100, y: -100 }, true],
    [{ x: 900, y: -100 }, false], // inside the notch
    [{ x: 900, y: -500 }, true],
    [{ x: -10, y: -100 }, false],
  ])('%j -> %s', (p, expected) => expect(pointInPolygon(p, l)).toBe(expected));
});

describe('isSimplePolygon', () => {
  it('accepts a rectangle and an L', () => {
    expect(isSimplePolygon(rectOutline(1000, 600))).toBe(true);
    expect(isSimplePolygon(lShapeOutline(1000, 600, 400, 300))).toBe(true);
  });

  it('rejects a bow-tie', () => {
    expect(isSimplePolygon([{ x: 0, y: 0 }, { x: 10, y: -10 }, { x: 10, y: 0 }, { x: 0, y: -10 }])).toBe(false);
  });

  it('rejects an edge that folds back over its neighbour', () => {
    expect(isSimplePolygon([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 0 }, { x: 5, y: -5 }])).toBe(false);
  });
});

describe('polygon relations', () => {
  const outer = square(0, 0, 1000);
  it('polygonInside needs clearance from the boundary', () => {
    expect(polygonInside(square(100, -100, 200), outer, 12.7)).toBe(true);
    expect(polygonInside(square(5, -100, 200), outer, 12.7)).toBe(false);
    expect(polygonInside(square(900, -100, 200), outer, 0)).toBe(false);
  });

  it('polygonsOverlap detects crossing, containment and separation', () => {
    expect(polygonsOverlap(square(0, 0, 100), square(50, -50, 100))).toBe(true);
    expect(polygonsOverlap(outer, square(100, -100, 50))).toBe(true);
    expect(polygonsOverlap(square(0, 0, 100), square(200, 0, 100))).toBe(false);
  });

  it('boundaryDistance is the gap between two separate shapes', () => {
    expect(boundaryDistance(square(0, 0, 100), square(150, 0, 100))).toBeCloseTo(50);
  });
});

describe('interiorAngles', () => {
  it('reads 90 for every corner of a rectangle', () => {
    for (const angle of interiorAngles(rectOutline(1000, 600))) expect(angle).toBeCloseTo(90);
  });

  it('reads 270 at the inside corner of an L', () => {
    const angles = interiorAngles(lShapeOutline(1000, 600, 400, 300)).map((a) => Math.round(a));
    expect(angles.filter((a) => a === 270)).toHaveLength(1);
    expect(angles.filter((a) => a === 90)).toHaveLength(5);
  });
});
