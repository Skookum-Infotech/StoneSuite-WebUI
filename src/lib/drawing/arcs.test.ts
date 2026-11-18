import { describe, expect, it } from 'vitest';
import {
  arcHeightOf, arcLength, arcPoints, arcRadius, arcSegmentArea, effectiveArcHeight, hasArcs, outlineAreaWithArcs,
  outlinePath, outlinePolyline, perimeterWithArcs, sidePath,
} from './arcs';
import { ARC_SEGMENTS } from './constants';
import { area, distance, rectOutline } from './geometry';

describe('arc measures', () => {
  it('a half circle (height = half the chord) has the textbook length and area', () => {
    expect(arcRadius(100, 50)).toBeCloseTo(50);
    expect(arcLength(100, 50)).toBeCloseTo(Math.PI * 50);
    expect(arcSegmentArea(100, 50)).toBeCloseTo((Math.PI * 50 * 50) / 2);
  });

  it('a flat side has no extra length or area, whichever way "height" is signed', () => {
    expect(arcLength(100, 0)).toBe(100);
    expect(arcSegmentArea(100, 0)).toBe(0);
    expect(arcLength(100, -20)).toBeCloseTo(arcLength(100, 20));
  });

  it('settles on a half circle when the chord was shortened below twice the height', () => {
    expect(effectiveArcHeight(60, 50)).toBe(30);
    expect(effectiveArcHeight(60, -50)).toBe(-30);
    expect(effectiveArcHeight(100, 20)).toBe(20);
  });

  it('reads a side\'s height from the edge list, 0 when it has none', () => {
    const edges = [{ index: 2, arcHeightMm: 30 }, { index: 3, code: 'EE' }];
    expect(arcHeightOf(edges, 2)).toBe(30);
    expect(arcHeightOf(edges, 3)).toBe(0);
    expect(arcHeightOf(undefined, 0)).toBe(0);
    expect(hasArcs(edges)).toBe(true);
    expect(hasArcs([{ index: 3, code: 'EE' }])).toBe(false);
  });
});

describe('arcPoints', () => {
  it('puts every point on the circle and the middle one at the crown, bulging left for a positive height', () => {
    const from = { x: 0, y: 0 };
    const to = { x: 100, y: 0 };
    const points = arcPoints(from, to, 50);
    expect(points).toHaveLength(ARC_SEGMENTS - 1);
    for (const p of points) expect(distance(p, { x: 50, y: 0 })).toBeCloseTo(50, 6);
    expect(points[ARC_SEGMENTS / 2 - 1].x).toBeCloseTo(50);
    expect(points[ARC_SEGMENTS / 2 - 1].y).toBeCloseTo(50);
  });

  it('bulges right for a negative height', () => {
    const points = arcPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, -20);
    const crown = points[ARC_SEGMENTS / 2 - 1];
    expect(crown.x).toBeCloseTo(50);
    expect(crown.y).toBeCloseTo(-20);
  });

  it('works on a sloped side', () => {
    const crown = arcPoints({ x: 0, y: 0 }, { x: 0, y: 100 }, 10)[ARC_SEGMENTS / 2 - 1];
    // Travelling up, left is -x.
    expect(crown.x).toBeCloseTo(-10);
    expect(crown.y).toBeCloseTo(50);
  });

  it('returns nothing for a straight or zero-length side', () => {
    expect(arcPoints({ x: 0, y: 0 }, { x: 100, y: 0 }, 0)).toEqual([]);
    expect(arcPoints({ x: 5, y: 5 }, { x: 5, y: 5 }, 10)).toEqual([]);
  });
});

describe('outlines with curved sides', () => {
  const rect = rectOutline(100, 50);

  it('hands back the very same outline when nothing is curved', () => {
    expect(outlinePolyline(rect, [])).toBe(rect);
    expect(outlinePolyline(rect, [{ index: 0, code: 'EE' }])).toBe(rect);
  });

  it('inserts the arc\'s points after the side\'s start corner', () => {
    const poly = outlinePolyline(rect, [{ index: 0, arcHeightMm: 25 }]);
    expect(poly).toHaveLength(rect.length + ARC_SEGMENTS - 1);
    expect(poly[0]).toEqual(rect[0]);
    expect(poly[ARC_SEGMENTS]).toEqual(rect[1]);
  });

  it('a bulge out adds the segment to the area, a bulge in takes it away', () => {
    const flat = area(rect);
    // The 100 mm top side bowed by half its length is a half circle of radius 50.
    const segment = (Math.PI * 50 * 50) / 2;
    expect(outlineAreaWithArcs(rect, [{ index: 0, arcHeightMm: 50 }], flat)).toBeCloseTo(flat + segment);
    expect(outlineAreaWithArcs(rect, [{ index: 0, arcHeightMm: -50 }], flat)).toBeCloseTo(flat - segment);
  });

  it('measures the perimeter along the curve', () => {
    const flat = 300;
    expect(perimeterWithArcs(rect, [])).toBeCloseTo(flat);
    expect(perimeterWithArcs(rect, [{ index: 0, arcHeightMm: 50 }])).toBeCloseTo(flat - 100 + Math.PI * 50);
  });
});

describe('SVG path data', () => {
  it('draws a straight side as a line and a curved one as an arc that bows the right way', () => {
    const a = { x: 0, y: 0 };
    const b = { x: 100, y: 0 };
    expect(sidePath(a, b, 0)).toBe('L100,0');
    expect(sidePath(a, b, 20)).toMatch(/^A[\d.]+,[\d.]+ 0 0 1 100,0$/);
    expect(sidePath(a, b, -20)).toMatch(/^A[\d.]+,[\d.]+ 0 0 0 100,0$/);
  });

  it('closes a whole outline', () => {
    const square = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }];
    expect(outlinePath(square, [])).toBe('M0,0 L10,0 L10,10 L0,10 L0,0 Z');
    expect(outlinePath(square, [{ index: 1, arcHeightMm: 2 }])).toContain(' A');
    expect(outlinePath([], [])).toBe('');
  });
});
