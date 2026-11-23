import { describe, expect, it } from 'vitest';
import { rectOutline } from '../geometry';
import { clipSegmentToPolygon } from './seamLines';

const box = rectOutline(1000, 600); // x 0..1000, y -600..0

describe('clipSegmentToPolygon', () => {
  it('cuts a seam that runs past both ends back to the stone', () => {
    const [part, ...rest] = clipSegmentToPolygon({ x: 500, y: 100 }, { x: 500, y: -700 }, box);
    expect(rest).toEqual([]);
    expect(part[0].y).toBeCloseTo(0);
    expect(part[1].y).toBeCloseTo(-600);
  });

  it('keeps a seam that is fully inside as it is', () => {
    const parts = clipSegmentToPolygon({ x: 100, y: -100 }, { x: 900, y: -100 }, box);
    expect(parts).toHaveLength(1);
    expect(parts[0][0].x).toBeCloseTo(100);
    expect(parts[0][1].x).toBeCloseTo(900);
  });

  it('drops a seam that is entirely outside', () => {
    expect(clipSegmentToPolygon({ x: 2000, y: 0 }, { x: 3000, y: 0 }, box)).toEqual([]);
  });

  it('gives two parts when a concave outline is crossed twice', () => {
    // A U: the notch (x 300..700, y -600..-200) is empty.
    const u = [
      { x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: -600 }, { x: 700, y: -600 },
      { x: 700, y: -200 }, { x: 300, y: -200 }, { x: 300, y: -600 }, { x: 0, y: -600 },
    ];
    expect(clipSegmentToPolygon({ x: -100, y: -400 }, { x: 1100, y: -400 }, u)).toHaveLength(2);
  });
});
