import { describe, expect, it } from 'vitest';
import type { EdgeFinish, Piece } from '@/types/drawing';
import { rectOutline } from '../geometry';
import { removalFraction, sampleSides, shapesEdge } from './edgeProfile';
import { PROFILE_LEVELS, profileRings } from './profileRings';

const box = rectOutline(1000, 600); // clockwise: side 0 top, 1 right, 2 bottom, 3 left
const finishes = (right: EdgeFinish): EdgeFinish[] => ['none', right, 'none', 'none'];

describe('removalFraction', () => {
  it('takes nothing off a square edge, or a finish it does not know', () => {
    expect(removalFraction('none', 0)).toBe(0);
    expect(removalFraction('beveled', 0.5)).toBe(0);
  });

  it('rounds a bullnose over the top and under the bottom, half the slab each way at the face', () => {
    expect(removalFraction('bullnose', 0)).toBeCloseTo(0.5, 1);
    expect(removalFraction('bullnose', 1)).toBeCloseTo(0.5, 1);
    expect(removalFraction('bullnose', 0.5)).toBeCloseTo(0, 2);
  });

  it('only softens the top for a bevel, and keeps the underside square', () => {
    expect(removalFraction('beveled', 0)).toBeGreaterThan(0.2);
    expect(removalFraction('beveled', 1)).toBeCloseTo(0, 2);
  });

  it('never goes negative and clamps outside the slab', () => {
    for (const f of ['raw', 'ogee', 'eased', 'waterfall', 'halfBullnose'] as EdgeFinish[]) {
      for (const t of [-1, 0, 0.25, 0.5, 0.75, 1, 2]) expect(removalFraction(f, t)).toBeGreaterThanOrEqual(0);
    }
  });
});

describe('shapesEdge', () => {
  it('is false for a plain edge and true for a profiled one', () => {
    expect(shapesEdge('none')).toBe(false);
    expect(shapesEdge('ogee')).toBe(true);
  });
});

describe('profileRings', () => {
  const rings = profileRings(box, finishes('bullnose'), 30);

  it('gives a ring per level, from the top face down to the underside', () => {
    expect(rings).toHaveLength(PROFILE_LEVELS + 1);
    expect(rings[0].heightMm).toBe(30);
    expect(rings[PROFILE_LEVELS].heightMm).toBe(0);
  });

  it('pulls only the finished side in, most at the faces and not at all mid-slab', () => {
    // Corners 1 and 2 are the ends of the right-hand side (x = 1000).
    expect(rings[0].points[1].x).toBeCloseTo(985, 0);
    expect(rings[0].points[2].x).toBeCloseTo(985, 0);
    expect(rings[PROFILE_LEVELS / 2].points[1].x).toBeCloseTo(1000, 1);
    expect(rings[PROFILE_LEVELS].points[1].x).toBeCloseTo(985, 0);
    // The other sides stay where they are.
    expect(rings[0].points[0]).toEqual({ x: 0, y: 0 });
    expect(rings[0].points[3]).toEqual({ x: 0, y: -600 });
  });

  it('keeps corners on their own side line when a finished side meets a plain one', () => {
    // Corner 1 sits on the top side (y = 0), so it only moves in x.
    expect(rings[0].points[1].y).toBeCloseTo(0);
  });

  it('mitres two finished sides meeting at a corner', () => {
    const both = profileRings(box, ['bullnose', 'bullnose', 'none', 'none'], 30);
    expect(both[0].points[1].x).toBeCloseTo(985, 0);
    expect(both[0].points[1].y).toBeCloseTo(-15, 0);
  });

  it('works on a counter-clockwise outline too', () => {
    const reversed = [...box].reverse();
    // Reversed, side 1 runs from (1000,-600) to (1000,0): the right-hand side again.
    const ccw = profileRings(reversed, ['none', 'bullnose', 'none', 'none'], 30);
    expect(ccw[0].points[1].x).toBeCloseTo(985, 0);
  });

  it('is a plain extrusion when no side has a finish', () => {
    const plain = profileRings(box, finishes('none'), 30);
    plain.forEach((ring) => expect(ring.points).toEqual(box));
  });
});

describe('sampleSides', () => {
  const piece = (edges: Piece['edges']): Pick<Piece, 'outline' | 'edges'> => ({ outline: box, edges });

  it('gives one segment per side for a straight outline', () => {
    const { points, sideOf } = sampleSides(piece([]));
    expect(points).toEqual(box);
    expect(sideOf).toEqual([0, 1, 2, 3]);
  });

  it('gives a curved side several segments, all belonging to that side', () => {
    const { points, sideOf } = sampleSides(piece([{ index: 1, arcHeightMm: 100 }]));
    expect(points.length).toBeGreaterThan(4);
    expect(sideOf.filter((s) => s === 1).length).toBe(points.length - 3);
  });
});
