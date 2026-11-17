import { describe, expect, it } from 'vitest';
import type { PieceEdge, Point } from '@/types/drawing';
import { MM_PER_INCH } from './constants';
import { applyBorder, DEFAULT_BORDER_PARAMS } from './borders';
import {
  applyCorner, CORNER_STYLES, cornerChangeAt, cornerFields, cornerGroup, DEFAULT_CORNER_PARAMS, removeCorner,
  type CornerParams,
} from './corners';
import { rectOutline } from './geometry';

// A 2000 x 800 slab: corners 0 (0,0), 1 (2000,0), 2 (2000,-800), 3 (0,-800) —
// clockwise, so sides A, B, C, D run top, right, bottom, left.
const outline = rectOutline(2000, 800);
const FOUR = 4 * MM_PER_INCH;
const params: CornerParams = { beforeMm: FOUR, afterMm: FOUR, heightMm: FOUR };
const ID = 'c1';

const piece = (edges: PieceEdge[] = []) => ({ outline, edges });

function applied(vertex: number, style: Parameters<typeof applyCorner>[2], p: CornerParams = params, edges: PieceEdge[] = []) {
  const result = applyCorner(piece(edges), vertex, style, p, ID);
  if (!result.ok) throw new Error(result.error);
  return result;
}

function expectPoints(actual: Point[], expected: Point[]) {
  expect(actual).toHaveLength(expected.length);
  actual.forEach((p, i) => {
    expect(p.x).toBeCloseTo(expected[i].x, 6);
    expect(p.y).toBeCloseTo(expected[i].y, 6);
  });
}

describe('cornerFields', () => {
  it('names the two sizes by the sides that meet at the corner', () => {
    expect(cornerFields('clip', 3, 6).map((f) => [f.key, f.letters])).toEqual([['beforeMm', 'C'], ['afterMm', 'D']]);
    // Corner 0 closes the loop: the side before it is the last one.
    expect(cornerFields('notch', 0, 4).map((f) => f.letters)).toEqual(['D', 'A']);
  });

  it('names a bump by its gaps and the two legs it makes, lettered on from the corner', () => {
    expect(cornerFields('bumpOut', 4, 8)).toEqual([
      { key: 'beforeMm', letters: 'D', caption: 'Gap' },
      { key: 'heightMm', letters: 'E, G', caption: 'Height' },
      { key: 'afterMm', letters: 'E', caption: 'Gap' },
    ]);
  });
});

describe('applyCorner geometry', () => {
  const base = { x: 2000 - FOUR, y: 0 };
  const down = { x: 2000, y: -FOUR };

  it('Clip cuts straight across, four inches along each side', () => {
    const { outline: out, edges } = applied(1, 'clip');
    expectPoints(out, [outline[0], base, down, outline[2], outline[3]]);
    expect(edges).toEqual([{ index: 1, cornerId: ID, cornerStyle: 'clip' }]);
  });

  it('Radius rounds the corner: an arc bowing toward it, a quarter circle at 4 x 4', () => {
    const { outline: out, edges } = applied(1, 'radius');
    expectPoints(out, [outline[0], base, down, outline[2], outline[3]]);
    // Quarter circle of radius 4": height = r (1 - cos 45°).
    expect(edges[0].arcHeightMm).toBeCloseTo(FOUR * (1 - Math.SQRT1_2), 6);
  });

  it('Radius In bows the other way, into the stone', () => {
    const { edges } = applied(1, 'radiusIn');
    expect(edges[0].arcHeightMm).toBeCloseTo(-FOUR * (1 - Math.SQRT1_2), 6);
  });

  it('Bump Out pushes a rotated rectangle out of the corner, the height at right angles to the cut', () => {
    const { outline: out, edges } = applied(1, 'bumpOut');
    const lift = FOUR * Math.SQRT1_2;
    expectPoints(out, [
      outline[0], base, { x: base.x + lift, y: lift }, { x: down.x + lift, y: down.y + lift }, down, outline[2], outline[3],
    ]);
    expect(edges.map((e) => e.index)).toEqual([1, 2, 3]);
    expect(edges.every((e) => e.cornerId === ID && e.cornerStyle === 'bumpOut')).toBe(true);
  });

  it('Bump In pushes it into the stone instead', () => {
    const { outline: out } = applied(1, 'bumpIn');
    const lift = FOUR * Math.SQRT1_2;
    expectPoints(out.slice(1, 6), [base, { x: base.x - lift, y: -lift }, { x: down.x - lift, y: down.y - lift }, down, outline[2]]);
  });

  it('Notch bites out a square: back along one side, across, and out along the other', () => {
    const { outline: out, edges } = applied(1, 'notch');
    expectPoints(out, [outline[0], base, { x: base.x, y: -FOUR }, down, outline[2], outline[3]]);
    expect(edges.map((e) => e.index)).toEqual([1, 2]);
  });

  it('takes the two sizes separately: the first along the side before, the second along the side after', () => {
    const { outline: out } = applied(1, 'clip', { ...params, beforeMm: 300, afterMm: 100 });
    expectPoints(out.slice(1, 3), [{ x: 1700, y: 0 }, { x: 2000, y: -100 }]);
  });

  it('works on the first corner, whose "before" side is the last', () => {
    const { outline: out, edges } = applied(0, 'clip', params, [{ index: 3, code: 'X' }, { index: 0, code: 'Y' }]);
    expectPoints(out, [{ x: 0, y: -FOUR }, { x: FOUR, y: 0 }, outline[1], outline[2], outline[3]]);
    // The new side is first; the old first side moves to B, the old last side to the new last.
    expect(edges).toEqual([
      { index: 0, cornerId: ID, cornerStyle: 'clip' },
      { index: 1, code: 'Y' },
      { index: 4, code: 'X' },
    ]);
  });

  it('keeps every other side\'s settings on the side they were on', () => {
    const { edges } = applied(1, 'notch', params, [{ index: 0, splashHeightMm: 100 }, { index: 2, code: 'W' }, { index: 3, code: 'Z' }]);
    expect(edges.filter((e) => e.cornerId === undefined)).toEqual([
      { index: 0, splashHeightMm: 100 }, { index: 4, code: 'W' }, { index: 5, code: 'Z' },
    ]);
  });

  it('gives the new sides the profile the two sides agree on', () => {
    const agree = applied(1, 'clip', params, [{ index: 0, code: 'W' }, { index: 1, code: 'W' }]);
    expect(agree.edges.find((e) => e.index === 1)).toMatchObject({ code: 'W', cornerId: ID });
    const differ = applied(1, 'clip', params, [{ index: 0, code: 'W' }, { index: 1, code: 'E' }]);
    expect(differ.edges.find((e) => e.index === 1)?.code).toBeUndefined();
  });

  it('works whichever way the outline winds', () => {
    const reversed = [...outline].reverse();
    const result = applyCorner({ outline: reversed, edges: [] }, 2, 'bumpOut', params, ID);
    if (!result.ok) throw new Error(result.error);
    // Out is still away from the stone: the bump's tip lies beyond the old corner's quadrant.
    const tip = result.outline[4];
    expect(tip.x).toBeGreaterThan(2000 - FOUR);
    expect(tip.y).toBeGreaterThan(0);
  });
});

describe('applyCorner refusals', () => {
  const refused = (
    vertex: number, p: CornerParams, edges: PieceEdge[] = [], style: Parameters<typeof applyCorner>[2] = 'clip',
  ) => {
    const result = applyCorner(piece(edges), vertex, style, p, ID);
    return result.ok ? null : result.error;
  };

  it.each([
    ['zero', { ...params, beforeMm: 0 }, 'Enter sizes above zero.'],
    ['negative', { ...params, afterMm: -4 }, 'Enter sizes above zero.'],
    ['not a number', { ...params, afterMm: Number.NaN }, 'Enter sizes above zero.'],
    ['past the side before', { ...params, beforeMm: 2000 }, 'Side A is too short for that size.'],
    ['past the side after', { ...params, afterMm: 800 }, 'Side B is too short for that size.'],
  ])('refuses a size that is %s', (_name, p, message) => {
    expect(refused(1, p)).toBe(message);
  });

  it('asks for a height on a bump only', () => {
    expect(refused(1, { ...params, heightMm: 0 }, [], 'bumpOut')).toBe('Enter a height above zero.');
    expect(refused(1, { ...params, heightMm: 0 })).toBeNull();
  });

  it('refuses a corner that is not there', () => {
    expect(refused(9, params)).toBe('That corner no longer exists.');
  });

  it('refuses a straight "corner"', () => {
    const straight = { outline: [...outline.slice(0, 1), { x: 1000, y: 0 }, ...outline.slice(1)], edges: [] };
    const result = applyCorner(straight, 1, 'clip', params, ID);
    expect(result).toEqual({ ok: false, error: 'That corner is straight — there is nothing to change.' });
  });

  it('refuses a curved side', () => {
    expect(refused(1, params, [{ index: 0, arcHeightMm: 40 }])).toBe('Side A is curved. A corner change needs two straight sides.');
  });

  it('refuses a corner next to a side a corner change already made', () => {
    const first = applied(1, 'clip');
    const again = applyCorner(first, 2, 'clip', params, 'c2');
    expect(again).toEqual({
      ok: false, error: 'Side B already has a corner change. Make it standard before applying another.',
    });
    // The corners at either end of the clip are next to it.
    expect(applyCorner(first, 1, 'notch', params, 'c2').ok).toBe(false);
  });

  it('refuses a corner inside a border, but allows the corner where a border ends', () => {
    const bumped = applyBorder({ outline, edges: [] }, 0, 'bumpOut', DEFAULT_BORDER_PARAMS, 'b1');
    if (!bumped.ok) throw new Error(bumped.error);
    // Corner 1 sits between the border's own first gap and its first leg.
    expect(applyCorner(bumped, 1, 'clip', params, ID)).toEqual({
      ok: false, error: 'That corner is part of a border. Make the border standard first.',
    });
    // The bump's far end meets the slab's own corner (now index 5).
    expect(applyCorner(bumped, 5, 'clip', { ...params, beforeMm: 50 }, ID).ok).toBe(true);
  });

  it('is refused by the Border tool in return: a corner change\'s sides take no border', () => {
    const clipped = applied(1, 'clip');
    const result = applyBorder(clipped, 1, 'fullRadiusOut', DEFAULT_BORDER_PARAMS, 'b1');
    expect(result).toEqual({
      ok: false, error: 'Side B belongs to a corner change. Make that corner standard before applying a border.',
    });
  });
});

describe('removeCorner', () => {
  const settings: PieceEdge[] = [{ index: 0, code: 'W' }, { index: 2, splashHeightMm: 80 }, { index: 3, code: 'Z' }];

  it.each(
    CORNER_STYLES.flatMap(({ id }) => [0, 1, 2, 3].map((vertex) => [id, vertex] as const)),
  )('%s on corner %i is undone exactly', (style, vertex) => {
    const changed = applied(vertex, style, params, settings);
    const back = removeCorner(changed, vertex);
    if (!back.ok) throw new Error(back.error);
    expectPoints(back.outline, outline);
    expect(back.edges).toEqual(settings);
  });

  it('works from any corner the change touches, including its own inner corners', () => {
    const changed = applied(1, 'bumpOut');
    for (const vertex of [1, 2, 3, 4]) {
      const back = removeCorner(changed, vertex);
      expect(back.ok).toBe(true);
    }
  });

  it('says so when there is nothing to remove', () => {
    expect(removeCorner(piece(), 1)).toEqual({ ok: false, error: 'That corner has no change to remove.' });
  });

  it('gives up when the change has been split since', () => {
    const changed = applied(1, 'bumpOut');
    // Another side was dropped in the middle of the change's sides.
    const broken = { outline: changed.outline, edges: changed.edges.filter((e) => e.index !== 2) };
    expect(removeCorner(broken, 1)).toEqual({
      ok: false,
      error: 'This corner has been changed since it was applied, so it cannot be made standard automatically.',
    });
  });

  it('puts the corner back where the two outer sides now meet, even after the slab was resized', () => {
    const changed = applied(1, 'clip');
    // Drag the whole right-hand end out by 100 (the clip's two points and the corner below).
    const moved = changed.outline.map((p) => (p.x > 1000 ? { x: p.x + 100, y: p.y } : p));
    const back = removeCorner({ outline: moved, edges: changed.edges }, 1);
    if (!back.ok) throw new Error(back.error);
    expectPoints(back.outline, [outline[0], { x: 2100, y: 0 }, { x: 2100, y: -800 }, outline[3]]);
  });
});

describe('cornerChangeAt / cornerGroup', () => {
  it('finds the change from either corner it touches', () => {
    const changed = applied(1, 'notch');
    expect(cornerChangeAt(changed.edges, 1, 6)).toMatchObject({ id: ID, style: 'notch', sides: [1, 2] });
    expect(cornerChangeAt(changed.edges, 3, 6)).toMatchObject({ id: ID });
    expect(cornerChangeAt(changed.edges, 5, 6)).toBeNull();
    expect(cornerGroup(changed.edges, 2)).toEqual([1, 2]);
    expect(cornerGroup(changed.edges, 0)).toEqual([0]);
  });

  it('has defaults of four inches', () => {
    expect(DEFAULT_CORNER_PARAMS).toEqual({ beforeMm: FOUR, afterMm: FOUR, heightMm: FOUR });
  });
});
