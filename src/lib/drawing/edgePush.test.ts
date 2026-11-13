import { describe, expect, it } from 'vitest';
import { MM_PER_INCH } from './constants';
import { dragSideOutline, edgeNormal, growLeg, joinOutline, pushEdge, sideDragComponents, snapAcrossToJoin, snapToStep } from './edgePush';
import { rectOutline } from './geometry';

const SIXTEENTH = MM_PER_INCH / 16;

describe('snapToStep', () => {
  it.each([
    { value: 0, expected: 0 },
    { value: SIXTEENTH * 0.4, expected: 0 },
    { value: SIXTEENTH * 0.6, expected: SIXTEENTH },
    { value: SIXTEENTH * 7.4, expected: SIXTEENTH * 7 },
    { value: -SIXTEENTH * 2.6, expected: -SIXTEENTH * 3 },
  ])('rounds $value to the nearest sixteenth', ({ value, expected }) => {
    expect(snapToStep(value, SIXTEENTH)).toBeCloseTo(expected, 9);
  });
});

describe('edgeNormal', () => {
  const rect = rectOutline(600, 400);

  it.each([
    { name: 'top side points up', index: 0, expected: { x: 0, y: 1 } },
    { name: 'right side points right', index: 1, expected: { x: 1, y: 0 } },
    { name: 'bottom side points down', index: 2, expected: { x: 0, y: -1 } },
    { name: 'left side points left', index: 3, expected: { x: -1, y: 0 } },
  ])('$name', ({ index, expected }) => {
    const normal = edgeNormal(rect, index);
    expect(normal?.x).toBeCloseTo(expected.x, 9);
    expect(normal?.y).toBeCloseTo(expected.y, 9);
  });

  it('is null for a side with no length', () => {
    expect(edgeNormal([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 5 }], 0)).toBeNull();
  });
});

describe('pushEdge', () => {
  const rect = rectOutline(600, 400);

  it('pulling the right side out lengthens the piece and leaves the left side alone', () => {
    const next = pushEdge(rect, 1, 50);
    expect(next.map((p) => p.x)).toEqual([0, 650, 650, 0]);
    expect(next.map((p) => p.y)).toEqual([0, 0, -400, -400]);
  });

  it('pulling the left side in shortens the piece from the left', () => {
    // Side 3 runs bottom-left -> top-left, so its normal points left (-x).
    const next = pushEdge(rect, 3, -100);
    expect(next.map((p) => p.x)).toEqual([100, 600, 600, 100]);
  });

  it('pulling the top side up deepens the piece and keeps the bottom side fixed', () => {
    const next = pushEdge(rect, 0, 25);
    expect(next.map((p) => p.y)).toEqual([25, 25, -400, -400]);
  });

  it('does not mutate the outline it was given', () => {
    const before = JSON.stringify(rect);
    pushEdge(rect, 1, 50);
    expect(JSON.stringify(rect)).toBe(before);
  });

  it('returns the outline untouched for a side with no length', () => {
    const flat = [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 5 }];
    expect(pushEdge(flat, 0, 10)).toEqual(flat);
  });
});


describe('growLeg', () => {
  // A 2000mm run, 600mm deep, with 600mm-wide legs: the C5 shape's proportions.
  const run = rectOutline(2000, 600);
  const LEG = 600;

  it('the right side pulled down grows a leg off the bottom-right corner, flush with the right side', () => {
    const { outline } = growLeg(run, 1, 400, LEG);
    expect(outline).toEqual([
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
      { x: 2000, y: -1000 }, // the right side, now 400 longer
      { x: 1400, y: -1000 }, // the leg's own end, LEG wide
      { x: 1400, y: -600 }, // where the leg meets the run
      { x: 0, y: -600 }, // the rest of the bottom side, untouched
    ]);
  });

  it('the right side pulled up grows the leg off the top-right corner instead', () => {
    const { outline } = growLeg(run, 1, -400, LEG);
    expect(outline).toEqual([
      { x: 0, y: 0 },
      { x: 1400, y: 0 },
      { x: 1400, y: 400 },
      { x: 2000, y: 400 },
      { x: 2000, y: -600 },
      { x: 0, y: -600 },
    ]);
  });

  it('reports only the far end of the leg as the border being pulled, not the whole leg', () => {
    expect(growLeg(run, 1, 400, LEG).moved).toEqual([{ x: 2000, y: -1000 }, { x: 1400, y: -1000 }]);
    expect(growLeg(run, 1, -400, LEG).moved).toEqual([{ x: 1400, y: 400 }, { x: 2000, y: 400 }]);
  });

  it('a piece barely wider than a leg is just extended, rather than left with a sliver', () => {
    const { outline } = growLeg(rectOutline(LEG + 10, 600), 1, 400, LEG);
    expect(outline).toEqual([
      { x: 0, y: 0 },
      { x: LEG + 10, y: 0 },
      { x: LEG + 10, y: -1000 },
      { x: 0, y: -1000 },
    ]);
  });

  it('leaves a corner that is not square alone', () => {
    const slanted = [{ x: 0, y: 0 }, { x: 2000, y: 0 }, { x: 2000, y: -600 }, { x: 0, y: -1000 }];
    expect(growLeg(slanted, 1, 400, LEG).outline).toBe(slanted);
  });

  it('a zero-length pull changes nothing', () => {
    expect(growLeg(run, 1, 0, LEG).outline).toBe(run);
  });
});

describe('sideDragComponents', () => {
  const run = rectOutline(2000, 600);

  it('splits a movement into across the side (its normal) and along it (corner i -> i+1)', () => {
    // Right side: across is +x, along is -y (it runs top to bottom).
    expect(sideDragComponents(run, 1, { x: 50, y: -300 })).toEqual({ across: 50, along: 300 });
  });

  it('is null for a side with no length', () => {
    expect(sideDragComponents([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 5 }], 0, { x: 1, y: 1 })).toBeNull();
  });
});

describe('dragSideOutline', () => {
  const LEG = 25.5 * MM_PER_INCH;
  const square = rectOutline(25.5 * MM_PER_INCH, 25.5 * MM_PER_INCH);

  it('with no leg, is just the resize, the side itself the border being pulled', () => {
    const { outline, moved } = dragSideOutline(square, 1, 100, 0, LEG);
    expect(outline).toEqual(pushEdge(square, 1, 100));
    expect(moved).toEqual([outline[1], outline[2]]);
  });

  it('pulled out to 100" and then up, the top side is cut to exactly 100" less 25 1/2"', () => {
    const out = 100 * MM_PER_INCH - 25.5 * MM_PER_INCH;
    const { outline } = dragSideOutline(square, 1, out, -400, LEG);
    expect(outline).toHaveLength(6);
    // Top side: from the left corner to where the leg starts.
    expect(outline[1].x - outline[0].x).toBeCloseTo(74.5 * MM_PER_INCH, 9);
    expect(outline[1].y).toBe(0);
    // The right side stays where the resize left it — 100" out.
    expect(outline[3].x).toBeCloseTo(100 * MM_PER_INCH, 9);
    expect(outline[4].x).toBeCloseTo(100 * MM_PER_INCH, 9);
  });
});

describe('bringing a leg back', () => {
  const LEG = 600;
  const run = rectOutline(2000, 600);
  // The right side pulled up 400: a leg off the top-right corner.
  const withLeg = growLeg(run, 1, -400, LEG).outline;
  const LEG_END = 2; // (1400,400) -> (2000,400), the side just made

  it('the end of the leg pulled back down onto the run joins it: one clean top side, no step', () => {
    const { outline } = dragSideOutline(withLeg, LEG_END, -400, 0, LEG);
    expect(outline).toEqual([
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
      { x: 2000, y: -600 },
      { x: 0, y: -600 },
    ]);
  });

  it('lands on the run even when the pointer stops a little short, within the join distance', () => {
    const { outline } = dragSideOutline(withLeg, LEG_END, -394, 0, LEG, 8);
    expect(outline).toHaveLength(4);
    expect(outline.map((p) => p.y)).toEqual([0, 0, -600, -600]);
  });

  it('stops short of the join distance and stays a step', () => {
    const { outline } = dragSideOutline(withLeg, LEG_END, -380, 0, LEG, 8);
    expect(outline).toHaveLength(6);
  });

  it('the inner side of the leg slid back out to the right side merges the whole leg away', () => {
    // Side 1 runs (1400,0) -> (1400,400), so its normal points -x: pushing
    // it 600 the other way carries it out to the right side.
    const { outline } = dragSideOutline(withLeg, 1, -600, 0, LEG);
    expect(outline).toEqual([
      { x: 0, y: 0 },
      { x: 2000, y: 0 },
      { x: 2000, y: -600 },
      { x: 0, y: -600 },
    ]);
  });
});

describe('snapAcrossToJoin', () => {
  it('leaves a four-sided piece alone: its only parallel side is the opposite one', () => {
    expect(snapAcrossToJoin(rectOutline(600, 400), 1, -595, 20)).toBe(-595);
  });
});

describe('joinOutline', () => {
  const rect = rectOutline(600, 400);

  it('keeps a corner added on purpose, even one in the middle of a straight side', () => {
    const split = [rect[0], { x: 300, y: 0 }, rect[1], rect[2], rect[3]];
    expect(joinOutline(split, [])).toEqual(split);
  });

  it('drops a corner the drag left on the straight line between its neighbours', () => {
    const next = [rect[0], { x: 300, y: 0 }, rect[1], rect[2], rect[3]];
    expect(joinOutline(next, [{ x: 300, y: 0 }])).toEqual(rect);
  });

  it('never goes below three corners', () => {
    const tri = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }];
    expect(joinOutline(tri, tri)).toHaveLength(3);
  });
});

describe('dragSideOutline — a staircase', () => {
  const LEG = 600;
  const run = rectOutline(2000, 600);
  const stairs = (dx: number, dy: number) => ({ delta: { x: dx, y: dy }, deadMm: 10, stepMm: 1 });

  it('up, then right: a second leg off the end of the first, the box untouched', () => {
    const { outline, moved } = dragSideOutline(run, 1, 0, -400, LEG, 0, stairs(300, 400));
    expect(outline).toEqual([
      { x: 0, y: 0 },
      { x: 1400, y: 0 },
      { x: 1400, y: 400 },
      { x: 2290, y: 400 }, // 300 across, less the 10 dead zone
      { x: 2290, y: -200 },
      { x: 2000, y: -200 },
      { x: 2000, y: -600 },
      { x: 0, y: -600 },
    ]);
    expect(moved).toEqual([{ x: 2290, y: 400 }, { x: 2290, y: -200 }]);
  });

  it('right, up, then right: the first run stays where it was left', () => {
    const { outline } = dragSideOutline(run, 1, 200, -400, LEG, 0, stairs(500, 400));
    expect(outline[5]).toEqual({ x: 2200, y: -200 });
    expect(outline[3].x).toBe(2490);
  });

  it('a turn inside the dead zone grows no second leg', () => {
    expect(dragSideOutline(run, 1, 0, -400, LEG, 0, stairs(8, 400)).outline).toHaveLength(6);
  });
});
