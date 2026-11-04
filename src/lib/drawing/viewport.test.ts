import { describe, expect, it } from 'vitest';
import type { Point } from '@/types/drawing';
import { pixelDeltaToMm, pixelDeltaToViewboxUnits, screenPointToMm } from './viewport';

function expectPoint(actual: Point, expected: Point) {
  expect(actual.x).toBeCloseTo(expected.x, 9);
  expect(actual.y).toBeCloseTo(expected.y, 9);
}

describe('pixelDeltaToViewboxUnits', () => {
  it('scales a pixel delta by how much smaller/larger the rendered SVG is than its 800x600 viewBox', () => {
    expect(pixelDeltaToViewboxUnits(10, 10, { width: 400, height: 300 })).toEqual({ x: 20, y: 20 });
    expect(pixelDeltaToViewboxUnits(10, 10, { width: 800, height: 600 })).toEqual({ x: 10, y: 10 });
    expect(pixelDeltaToViewboxUnits(10, 10, { width: 1600, height: 1200 })).toEqual({ x: 5, y: 5 });
  });
});

// The canvas fills whatever space the page gives it, which is rarely 4:3.
// The SVG keeps its drawing's proportions (a square piece stays square) by
// scaling the 800x600 viewBox to fit and centring it, so one pixel is the
// same number of viewBox units in both directions.
describe('on a canvas that is not 4:3', () => {
  it('scales both axes alike on a wide canvas, set by its height', () => {
    expect(pixelDeltaToViewboxUnits(10, 10, { width: 1600, height: 600 })).toEqual({ x: 10, y: 10 });
  });

  it('scales both axes alike on a tall canvas, set by its width', () => {
    expect(pixelDeltaToViewboxUnits(10, 10, { width: 400, height: 1200 })).toEqual({ x: 20, y: 20 });
  });

  it('still maps the middle of a wide canvas to the world origin', () => {
    const rect = { left: 100, top: 50, width: 1600, height: 600 };
    expectPoint(screenPointToMm(100 + 800, 50 + 300, rect, 1, { x: 0, y: 0 }), { x: 0, y: 0 });
  });

  // The old per-axis mapping put this click 50 units, not 100, from centre.
  it('maps a click 100px right of the middle of a wide canvas to 100mm', () => {
    const rect = { left: 0, top: 0, width: 1600, height: 600 };
    expectPoint(screenPointToMm(800 + 100, 300, rect, 1, { x: 0, y: 0 }), { x: 100, y: 0 });
  });

  it('maps a click 100px above the middle of a tall canvas to 200mm at 2 units a pixel', () => {
    const rect = { left: 0, top: 0, width: 400, height: 1200 };
    expectPoint(screenPointToMm(200, 600 - 100, rect, 1, { x: 0, y: 0 }), { x: 0, y: 200 });
  });

  it('lets a click out in the extra width of a wide canvas land outside the 800 unit viewBox', () => {
    const rect = { left: 0, top: 0, width: 1600, height: 600 };
    expectPoint(screenPointToMm(0, 300, rect, 1, { x: 0, y: 0 }), { x: -800, y: 0 });
  });

  it('moves a drag the same distance on screen in both directions', () => {
    const { x, y } = pixelDeltaToMm(50, 50, { width: 1600, height: 600 }, 2);
    expect(x).toBeCloseTo(25, 9);
    expect(y).toBeCloseTo(-25, 9);
  });
});

describe('pixelDeltaToMm', () => {
  it('converts a pixel delta to world mm: viewbox-scaled, un-zoomed, y negated', () => {
    // 1:1 rendered size, zoom 1 -> pixels map straight to mm, y flips sign.
    expect(pixelDeltaToMm(10, 10, { width: 800, height: 600 }, 1)).toEqual({ x: 10, y: -10 });
    // Rendered at half size -> each pixel covers 2 viewbox units.
    expect(pixelDeltaToMm(10, 10, { width: 400, height: 300 }, 1)).toEqual({ x: 20, y: -20 });
    // Zoomed in 2x -> the same pixel delta covers half the world distance.
    expect(pixelDeltaToMm(10, 10, { width: 800, height: 600 }, 2)).toEqual({ x: 5, y: -5 });
  });
});

describe('screenPointToMm', () => {
  it('maps the viewport center to world origin at zoom 1, no pan', () => {
    const rect = { left: 0, top: 0, width: 800, height: 600 };
    expectPoint(screenPointToMm(400, 300, rect, 1, { x: 0, y: 0 }), { x: 0, y: 0 });
  });

  it('maps a point right of center to a positive world x, and above center to a positive world y', () => {
    const rect = { left: 0, top: 0, width: 800, height: 600 };
    expectPoint(screenPointToMm(500, 300, rect, 1, { x: 0, y: 0 }), { x: 100, y: 0 });
    expectPoint(screenPointToMm(400, 200, rect, 1, { x: 0, y: 0 }), { x: 0, y: 100 });
  });

  it('accounts for the SVG\'s own on-screen offset (rect.left/top) and a non-1:1 rendered size', () => {
    const rect = { left: 50, top: 20, width: 400, height: 300 }; // rendered at half size
    // Click at the rendered center (50+200, 20+150) should still map to world origin.
    expectPoint(screenPointToMm(250, 170, rect, 1, { x: 0, y: 0 }), { x: 0, y: 0 });
  });

  it('un-pans and un-zooms the result', () => {
    const rect = { left: 0, top: 0, width: 800, height: 600 };
    // Panned 50 viewbox-units right: the viewport center now shows world x=-50.
    expectPoint(screenPointToMm(400, 300, rect, 1, { x: 50, y: 0 }), { x: -50, y: 0 });
    // Zoomed 2x: the same 100px offset from center covers half the world distance.
    expectPoint(screenPointToMm(500, 300, rect, 2, { x: 0, y: 0 }), { x: 50, y: 0 });
  });
});
