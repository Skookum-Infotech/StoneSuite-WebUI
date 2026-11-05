import { describe, expect, it } from 'vitest';
import { rectOutline } from './geometry';
import { snapNudge } from './snapping';

const at = (x: number, y: number, l = 1000, w = 600) => rectOutline(l, w).map((p) => ({ x: p.x + x, y: p.y + y }));

describe('snapNudge', () => {
  const fixed = at(0, 0);

  it.each([
    ['flush to the right of a neighbour, a few mm off', at(1006, 0), { x: -6, y: 0 }],
    ['sliding along an edge keeps its own y', at(1004, -300), { x: -4, y: 0 }],
    ['out of tolerance on both axes', at(1100, -300), { x: 0, y: 0 }],
    ['aligned on y only', at(5000, 5), { x: 0, y: -5 }],
  ])('%s', (_name, moving, expected) => {
    const nudge = snapNudge(moving, [fixed], 12);
    expect(nudge.x).toBeCloseTo(expected.x);
    expect(nudge.y).toBeCloseTo(expected.y);
  });

  it('does nothing when there is nothing to snap to', () => {
    expect(snapNudge(at(3, 3), [], 12)).toEqual({ x: 0, y: 0 });
  });

  it('picks the closest candidate', () => {
    const nudge = snapNudge(at(1008, 0), [at(0, 0), at(1010, 0)], 12);
    expect(nudge.x).toBeCloseTo(2);
  });
});
