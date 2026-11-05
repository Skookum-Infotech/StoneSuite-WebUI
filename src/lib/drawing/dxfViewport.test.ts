import { describe, expect, it } from 'vitest';
import { fitViewBox, panBy, screenToWorld, zoomAt, type ViewBox } from './dxfViewport';

const rect = { left: 100, top: 50, width: 400, height: 200 };

describe('fitViewBox', () => {
  it('wraps the drawing with a margin on every side', () => {
    const vb = fitViewBox({ minX: 0, minY: 0, maxX: 100, maxY: 50 });
    expect(vb.x).toBeLessThan(0);
    expect(vb.y).toBeLessThan(0);
    expect(vb.x + vb.w).toBeGreaterThan(100);
    expect(vb.y + vb.h).toBeGreaterThan(50);
  });

  // A lone horizontal line, or an empty file, has zero height: a zero-size
  // viewBox renders nothing at all.
  it.each([
    ['a horizontal line', { minX: 0, minY: 5, maxX: 100, maxY: 5 }],
    ['a single point', { minX: 5, minY: 5, maxX: 5, maxY: 5 }],
  ])('never collapses to zero size for %s', (_name, bounds) => {
    const vb = fitViewBox(bounds);
    expect(vb.w).toBeGreaterThan(0);
    expect(vb.h).toBeGreaterThan(0);
  });
});

describe('screenToWorld', () => {
  it('maps the middle of the element to the middle of the view', () => {
    const vb: ViewBox = { x: 0, y: 0, w: 100, h: 50 };
    expect(screenToWorld(vb, rect, 300, 150)).toEqual({ x: 50, y: 25 });
  });

  // SVG keeps its aspect ratio by centring the view with empty bands.
  it('accounts for letterboxing when the view is narrower than the element', () => {
    const vb: ViewBox = { x: 0, y: 0, w: 50, h: 50 };
    // 200px tall → 4 units/px... the 50-unit square is 200px wide, centred in 400px.
    expect(screenToWorld(vb, rect, 200, 50)).toEqual({ x: 0, y: 0 });
    expect(screenToWorld(vb, rect, 400, 250)).toEqual({ x: 50, y: 50 });
  });
});

describe('zoomAt', () => {
  const fit: ViewBox = { x: 0, y: 0, w: 100, h: 100 };

  it('keeps the point under the cursor fixed', () => {
    const focus = { x: 25, y: 75 };
    const zoomed = zoomAt(fit, fit, 2, focus);
    expect(zoomed.w).toBe(50);
    expect((focus.x - zoomed.x) / zoomed.w).toBeCloseTo((focus.x - fit.x) / fit.w);
    expect((focus.y - zoomed.y) / zoomed.h).toBeCloseTo((focus.y - fit.y) / fit.h);
  });

  it('stops zooming in at the limit', () => {
    let vb = fit;
    for (let i = 0; i < 100; i += 1) vb = zoomAt(vb, fit, 2, { x: 50, y: 50 });
    expect(vb.w).toBeGreaterThan(0.01);
    expect(zoomAt(vb, fit, 2, { x: 50, y: 50 })).toEqual(vb);
  });

  it('stops zooming out at the limit', () => {
    let vb = fit;
    for (let i = 0; i < 100; i += 1) vb = zoomAt(vb, fit, 0.5, { x: 50, y: 50 });
    expect(vb.w).toBeLessThan(1000);
    expect(zoomAt(vb, fit, 0.5, { x: 50, y: 50 })).toEqual(vb);
  });
});

describe('panBy', () => {
  it('moves the view opposite to the drag, in world units', () => {
    const vb: ViewBox = { x: 0, y: 0, w: 100, h: 50 };
    // 400px shows 100 units: 0.25 units per px.
    expect(panBy(vb, 40, -20, rect)).toEqual({ x: -10, y: 5, w: 100, h: 50 });
  });

  it('does nothing while the element has no size yet', () => {
    const vb: ViewBox = { x: 0, y: 0, w: 100, h: 50 };
    expect(panBy(vb, 40, 40, { left: 0, top: 0, width: 0, height: 0 })).toEqual(vb);
  });
});
