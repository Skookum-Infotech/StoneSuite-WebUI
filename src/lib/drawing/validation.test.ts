import { describe, expect, it } from 'vitest';
import type { Point } from '@/types/drawing';
import { lShapeOutline, rectOutline } from './geometry';
import { validateOutline, validatePiece } from './validation';

describe('validateOutline', () => {
  it.each<[string, Point[], string | null]>([
    ['a rectangle', rectOutline(1000, 600), null],
    ['an L', lShapeOutline(1000, 600, 400, 300), null],
    ['two points', [{ x: 0, y: 0 }, { x: 5, y: 5 }], 'at least 3 corners'],
    ['a bow-tie', [{ x: 0, y: 0 }, { x: 100, y: -100 }, { x: 100, y: 0 }, { x: 0, y: -60 }], 'cross each other'],
    ['a repeated corner', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 100, y: -100 }, { x: 0, y: -100 }], 'Side 2 is too short'],
    ['collinear points', [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }], 'no area'],
    ['an absurdly large piece', rectOutline(40000, 600), 'maximum supported size'],
    ['a NaN corner', [{ x: 0, y: 0 }, { x: NaN, y: 0 }, { x: 10, y: -10 }], 'invalid position'],
  ])('%s', (_name, outline, expected) => {
    const issues = validateOutline(outline);
    if (expected === null) expect(issues).toEqual([]);
    else expect(issues.join(' ')).toContain(expected);
  });
});

describe('validatePiece', () => {
  it('rejects a non-positive thickness', () => {
    expect(validatePiece({ outline: rectOutline(1000, 600), thicknessMm: 0, cutouts: [] })).toContain('Thickness must be above zero.');
  });

  it('reports a cutout that no longer fits after the outline shrinks', () => {
    const cutouts = [{ id: 'c', type: 'sink' as const, shape: 'rect' as const, center: { x: 700, y: -300 }, widthMm: 400, depthMm: 300 }];
    expect(validatePiece({ outline: rectOutline(1000, 600), thicknessMm: 30, cutouts })).toEqual([]);
    expect(validatePiece({ outline: rectOutline(900, 600), thicknessMm: 30, cutouts })).toHaveLength(1);
  });
});
