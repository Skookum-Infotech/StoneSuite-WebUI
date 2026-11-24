import { describe, expect, it } from 'vitest';
import { TEXT_SCALE_FLOOR_ZOOM } from './constants';
import { canvasTextScaleDivisor } from './textScale';

describe('canvasTextScaleDivisor', () => {
  it('returns the zoom itself across the normal editing range, so dividing by it gives a constant on-screen size', () => {
    expect(canvasTextScaleDivisor(1, 13, 9)).toBeCloseTo(1);
    expect(canvasTextScaleDivisor(4, 13, 9)).toBeCloseTo(4);
    expect(canvasTextScaleDivisor(TEXT_SCALE_FLOOR_ZOOM, 13, 9)).toBeCloseTo(TEXT_SCALE_FLOOR_ZOOM);
  });

  it('holds at TEXT_SCALE_FLOOR_ZOOM below it, as long as that still keeps referencePx above minPx on screen', () => {
    // referencePx=13 at this zoom, divided by the floor-held divisor, would
    // put the text's on-screen size comfortably above minPx=9: unclamped.
    const zoom = 0.3;
    const divisor = canvasTextScaleDivisor(zoom, 13, 9);
    expect(divisor).toBeCloseTo(TEXT_SCALE_FLOOR_ZOOM);
    expect((13 / divisor) * zoom).toBeGreaterThan(9);
  });

  it('switches to a divisor that pins referencePx exactly at minPx once the floor-based shrink would take it lower', () => {
    const zoom = 0.05;
    const divisor = canvasTextScaleDivisor(zoom, 13, 9);
    expect((13 / divisor) * zoom).toBeCloseTo(9);
  });

  it('keeps referencePx pinned at exactly minPx at any zoom small enough to need clamping, not just near the threshold', () => {
    const onScreenAt = (zoom: number) => (13 / canvasTextScaleDivisor(zoom, 13, 9)) * zoom;
    expect(onScreenAt(0.05)).toBeCloseTo(9);
    expect(onScreenAt(0.02)).toBeCloseTo(9);
    expect(onScreenAt(0.002)).toBeCloseTo(9);
  });

  it('scales a different value sharing the same divisor proportionally to referencePx, even once clamped', () => {
    // A dimension's stand-off (28px) sharing its text's (13px) divisor should
    // settle at 28 * (9/13) on screen once the text itself is pinned at 9.
    const zoom = 0.05;
    const divisor = canvasTextScaleDivisor(zoom, 13, 9);
    const standOffOnScreen = (28 / divisor) * zoom;
    expect(standOffOnScreen).toBeCloseTo(28 * (9 / 13));
  });
});
