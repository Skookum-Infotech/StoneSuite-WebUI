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
