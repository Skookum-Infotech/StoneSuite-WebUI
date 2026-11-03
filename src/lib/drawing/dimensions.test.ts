import { describe, expect, it } from 'vitest';
import { rectOutline } from './geometry';
import { layoutEdgeDimensions } from './dimensions';
import { DEFAULT_DIMENSION_OFFSET_MM } from './constants';

describe('layoutEdgeDimensions', () => {
  it('offsets a 600x400 rect\'s 4 edges outward by the given amount, one layout per edge', () => {
    const layouts = layoutEdgeDimensions(rectOutline(600, 400), 25.4);
    expect(layouts).toHaveLength(4);
    const [top, right, bottom, left] = layouts;
    expect(top).toMatchObject({ lineFrom: { x: 0, y: 25.4 }, lineTo: { x: 600, y: 25.4 }, textAt: { x: 300, y: 25.4 }, rotationDeg: 0, lengthMm: 600 });
    expect(right).toMatchObject({ lineFrom: { x: 625.4, y: 0 }, lineTo: { x: 625.4, y: -400 }, textAt: { x: 625.4, y: -200 }, rotationDeg: 90, lengthMm: 400 });
    expect(bottom).toMatchObject({ lineFrom: { x: 600, y: -425.4 }, lineTo: { x: 0, y: -425.4 }, textAt: { x: 300, y: -425.4 }, rotationDeg: 0, lengthMm: 600 });
    expect(left).toMatchObject({ lineFrom: { x: -25.4, y: -400 }, lineTo: { x: -25.4, y: 0 }, textAt: { x: -25.4, y: -200 }, rotationDeg: 90, lengthMm: 400 });
  });

  it('defaults the offset to DEFAULT_DIMENSION_OFFSET_MM when omitted', () => {
    expect(layoutEdgeDimensions(rectOutline(600, 400))[0].lineFrom.y).toBeCloseTo(DEFAULT_DIMENSION_OFFSET_MM, 5);
  });

  it('skips a zero-length edge (a duplicate point) instead of producing NaN geometry', () => {
    // A rect with a duplicated corner — one edge has zero length.
    const outlineWithDuplicate = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -400 }, { x: 0, y: -400 }];
    const layouts = layoutEdgeDimensions(outlineWithDuplicate);
    expect(layouts.every((l) => l.lengthMm > 0)).toBe(true);
    expect(layouts.every((l) => Number.isFinite(l.lineFrom.x) && Number.isFinite(l.lineFrom.y))).toBe(true);
  });
});
