import { describe, it, expect } from 'vitest';
import { sparklineGeometry } from './sparkline';

// Default geometry box: width 78, height 26, 2px stroke padding — so the
// drawable band runs y=2 (top) to y=24 (bottom), span 22.

describe('sparklineGeometry', () => {
  it('returns empty geometry for no points', () => {
    expect(sparklineGeometry([])).toEqual({ line: '', area: '', last: null });
  });

  it('centres a single point and draws no area', () => {
    expect(sparklineGeometry([5])).toEqual({
      line: '39,13',
      area: '',
      last: { x: 39, y: 13 },
    });
  });

  it('draws a flat series along the vertical midline', () => {
    const geo = sparklineGeometry([7, 7, 7]);
    expect(geo.line).toBe('0,13 39,13 78,13');
    expect(geo.last).toEqual({ x: 78, y: 13 });
  });

  it('maps the lowest value to the bottom and the highest to the top', () => {
    const geo = sparklineGeometry([0, 10]);
    expect(geo.line).toBe('0,24 78,2');
    expect(geo.area).toBe('M 0,24 L 0,24 L 78,2 L 78,24 Z');
    expect(geo.last).toEqual({ x: 78, y: 2 });
  });

  it('places evenly spaced points across the width', () => {
    const geo = sparklineGeometry([0, 5, 10]);
    expect(geo.line).toBe('0,24 39,13 78,2');
    expect(geo.last).toEqual({ x: 78, y: 2 });
  });

  it('honours a custom width and height', () => {
    const geo = sparklineGeometry([0, 1], { width: 100, height: 12 });
    // band runs y=2..10, span 8
    expect(geo.line).toBe('0,10 100,2');
    expect(geo.last).toEqual({ x: 100, y: 2 });
  });
});
