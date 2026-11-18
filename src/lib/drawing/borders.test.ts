import { describe, expect, it } from 'vitest';
import type { PieceEdge } from '@/types/drawing';
import {
  applyBorder, BORDER_STYLES, borderFields, borderGroup, borderOn, borderStyleDef, DEFAULT_BORDER_PARAMS, removeBorder,
  type BorderParams, type BorderStyle,
} from './borders';
import { distance, rectOutline } from './geometry';
import { outlinePolyline } from './arcs';
import { validateOutline } from './validation';

// Clockwise, top side (index 0) runs left to right and "out" is up (+y).
const rect = rectOutline(1000, 600);
const params: BorderParams = { gap1Mm: 100, heightMm: 50, gap2Mm: 100 };

/** The sides' own settings, without the bookkeeping that says which border made them. */
const bare = (edges: PieceEdge[]) => edges.map((e) => {
  const rest = { ...e };
  delete rest.borderId;
  delete rest.borderStyle;
  return rest;
}).filter((e) => Object.keys(e).length > 1);

function apply(style: BorderStyle, index = 0, edges: PieceEdge[] = [], p: BorderParams = params) {
  const result = applyBorder({ outline: rect, edges }, index, style, p, 'b1');
  if (!result.ok) throw new Error(result.error);
  return result;
}

describe('defaults', () => {
  it('start at a 4 inch gap and a 3 inch height', () => {
    expect(DEFAULT_BORDER_PARAMS.gap1Mm).toBeCloseTo(101.6);
    expect(DEFAULT_BORDER_PARAMS.gap2Mm).toBeCloseTo(101.6);
    expect(DEFAULT_BORDER_PARAMS.heightMm).toBeCloseTo(76.2);
  });

  it('there are six styles, each out or in', () => {
    expect(BORDER_STYLES.map((s) => s.label)).toEqual([
      'Full Radius Out', 'Full Radius In', 'Bump Out', 'Bump In', 'Arc Bump Out', 'Arc Bump In',
    ]);
    expect(borderStyleDef('bumpIn').direction).toBe(-1);
  });
});

describe('full radius', () => {
  it('bows the side out without touching the corners', () => {
    const r = apply('fullRadiusOut');
    expect(r.outline).toEqual(rect);
    expect(bare(r.edges)).toEqual([{ index: 0, arcHeightMm: 50 }]);
  });

  it('bows it in with a negative height', () => {
    expect(bare(apply('fullRadiusIn').edges)).toEqual([{ index: 0, arcHeightMm: -50 }]);
  });

  it('keeps the side\'s other settings and replaces an earlier bow', () => {
    const r = apply('fullRadiusOut', 0, [{ index: 0, code: 'EE', arcHeightMm: -10 }]);
    expect(bare(r.edges)).toEqual([{ index: 0, code: 'EE', arcHeightMm: 50 }]);
  });

  it('refuses an arc taller than half the side', () => {
    const r = applyBorder({ outline: rect, edges: [] }, 0, 'fullRadiusOut', { ...params, heightMm: 501 });
    expect(r).toEqual({ ok: false, error: 'Side A is too short for that arc height.' });
  });

  it('works whichever way the outline winds', () => {
    const counter = [...rect].reverse();
    const r = applyBorder({ outline: counter, edges: [] }, 0, 'fullRadiusOut', params);
    // Reversed, the stone is on the other side of travel: out is now the right.
    expect(r.ok && bare(r.edges)).toEqual([{ index: 0, arcHeightMm: -50 }]);
  });
});

describe('bump', () => {
  it('steps the side out between the two gaps: four new corners, five sides', () => {
    const r = apply('bumpOut');
    expect(r.outline).toEqual([
      { x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }, { x: 900, y: 50 }, { x: 900, y: 0 },
      { x: 1000, y: 0 }, { x: 1000, y: -600 }, { x: 0, y: -600 },
    ]);
    expect(validateOutline(r.outline)).toEqual([]);
  });

  it('steps it in', () => {
    const r = apply('bumpIn');
    expect(r.outline.slice(1, 5)).toEqual([
      { x: 100, y: 0 }, { x: 100, y: -50 }, { x: 900, y: -50 }, { x: 900, y: 0 },
    ]);
  });

  it('measures the first gap from the side\'s start corner and the second back from its end', () => {
    const r = apply('bumpOut', 0, [], { gap1Mm: 200, heightMm: 30, gap2Mm: 50 });
    expect(r.outline[1].x).toBe(200);
    expect(r.outline[4].x).toBe(950);
  });

  it('shifts the settings of every later side by the four sides gained, and the side\'s own onto all five', () => {
    const r = apply('bumpOut', 0, [{ index: 0, code: 'EE' }, { index: 2, code: 'BN' }]);
    expect(r.edges.filter((e) => e.code === 'EE').map((e) => e.index)).toEqual([0, 1, 2, 3, 4]);
    expect(r.edges.find((e) => e.code === 'BN')?.index).toBe(6);
  });

  it('gives the legs only the profile, not a splash or waterfall', () => {
    const r = apply('bumpOut', 0, [{ index: 0, code: 'EE', splashHeightMm: 100 }]);
    expect(r.edges.map((e) => [e.index, e.splashHeightMm])).toEqual([[0, 100], [1, undefined], [2, 100], [3, undefined], [4, 100]]);
  });

  it('reshapes the closing side, whose far corner is the first corner', () => {
    // Side 3 runs (0,-600) -> (0,0) up the left; out is -x.
    const r = apply('bumpOut', 3);
    expect(r.outline).toHaveLength(8);
    expect(r.outline.slice(4)).toEqual([
      { x: 0, y: -500 }, { x: -50, y: -500 }, { x: -50, y: -100 }, { x: 0, y: -100 },
    ]);
  });

  it('refuses gaps that leave no room, and gaps of zero', () => {
    expect(applyBorder({ outline: rect, edges: [] }, 0, 'bumpOut', { ...params, gap1Mm: 600, gap2Mm: 500 }))
      .toEqual({ ok: false, error: 'The gaps leave no room on side A.' });
    expect(applyBorder({ outline: rect, edges: [] }, 0, 'bumpOut', { ...params, gap1Mm: 0 }))
      .toEqual({ ok: false, error: 'Gaps must be above zero.' });
  });

  it('refuses a height that is not above zero', () => {
    expect(applyBorder({ outline: rect, edges: [] }, 0, 'bumpOut', { ...params, heightMm: 0 }))
      .toEqual({ ok: false, error: 'Enter a height above zero.' });
  });
});

describe('arc bump', () => {
  it('keeps two straight gaps and bows the side between them', () => {
    const r = apply('arcBumpOut');
    expect(r.outline.slice(0, 4)).toEqual([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 900, y: 0 }, { x: 1000, y: 0 }]);
    expect(bare(r.edges)).toEqual([{ index: 1, arcHeightMm: 50 }]);
  });

  it('bows inward for the In style', () => {
    expect(bare(apply('arcBumpIn').edges)).toEqual([{ index: 1, arcHeightMm: -50 }]);
  });

  it('shifts later sides by the two sides gained', () => {
    const r = apply('arcBumpOut', 0, [{ index: 2, code: 'BN' }]);
    expect(r.edges.find((e) => e.code === 'BN')?.index).toBe(4);
  });

  it('refuses an arch taller than half the space between the gaps', () => {
    const r = applyBorder({ outline: rect, edges: [] }, 0, 'arcBumpOut', { gap1Mm: 400, gap2Mm: 400, heightMm: 150 });
    expect(r.ok).toBe(false);
  });

  it('stays a valid piece once the arc is expanded', () => {
    const r = apply('arcBumpOut');
    expect(validateOutline(outlinePolyline(r.outline, r.edges))).toEqual([]);
    expect(distance(r.outline[1], r.outline[2])).toBe(800);
  });
});

describe('the letters the form shows', () => {
  it('name the sides the reshape creates, in the drawing\'s own lettering', () => {
    expect(borderFields('fullRadiusOut', 2)).toEqual([{ key: 'heightMm', letters: 'C', caption: 'Arc height' }]);
    expect(borderFields('bumpOut', 0).map((f) => [f.key, f.letters])).toEqual([
      ['gap1Mm', 'A'], ['heightMm', 'B, D'], ['gap2Mm', 'E'],
    ]);
    expect(borderFields('bumpIn', 4).map((f) => f.letters)).toEqual(['E', 'F, H', 'I']);
    expect(borderFields('arcBumpOut', 4).map((f) => [f.letters, f.caption])).toEqual([
      ['E', 'Gap'], ['F', 'Arch height'], ['G', 'Gap'],
    ]);
  });

  it('match the sides applyBorder really creates', () => {
    const r = apply('bumpOut', 0, [{ index: 0, code: 'EE' }]);
    // E, F, G, H, I in the reference drawing are sides 4..8 of that one's outline: here 0..4.
    expect(r.edges.map((e) => e.index)).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('one border per side', () => {
  const STYLES_WITH_SIDES: Array<[BorderStyle, number]> = [
    ['fullRadiusOut', 1], ['fullRadiusIn', 1], ['bumpOut', 5], ['bumpIn', 5], ['arcBumpOut', 3], ['arcBumpIn', 3],
  ];

  it.each(STYLES_WITH_SIDES)('%s tags every side it makes, and only those, with one shared id and its style', (style, sides) => {
    const r = apply(style, 0, [{ index: 2, code: 'BN' }]);
    const tagged = r.edges.filter((e) => e.borderId);
    expect(tagged).toHaveLength(sides);
    expect(new Set(tagged.map((e) => e.borderId))).toEqual(new Set(['b1']));
    expect(tagged.every((e) => e.borderStyle === style)).toBe(true);
    expect(borderGroup(r.edges, 0)).toEqual(Array.from({ length: sides }, (_, i) => i));
    expect(borderOn(r.edges, 0)).toBe(style);
    // The far side that was never touched moved along (side 2 -> 2 + the sides gained) and is not part of it.
    const untouched = 2 + (sides - 1);
    expect(borderOn(r.edges, untouched)).toBeUndefined();
    expect(r.edges.find((e) => e.index === untouched)?.code).toBe('BN');
  });

  it.each(BORDER_STYLES.map((s) => s.id))('refuses %s on a side that already has a border', (style) => {
    const first = apply('bumpOut');
    // Any side of the bump counts — gap, leg or middle.
    for (const index of [0, 1, 2, 3, 4]) {
      const again = applyBorder({ outline: first.outline, edges: first.edges }, index, style, params);
      expect(again).toEqual({
        ok: false, error: `Side ${'ABCDE'[index]} already has a border. Make it standard before applying another.`,
      });
    }
  });

  it('still lets a different, untouched side take a border', () => {
    const first = apply('fullRadiusOut');
    const second = applyBorder({ outline: first.outline, edges: first.edges }, 2, 'fullRadiusIn', params, 'b2');
    expect(second.ok).toBe(true);
    expect(second.ok && second.edges.map((e) => [e.index, e.borderId])).toEqual([[0, 'b1'], [2, 'b2']]);
  });

  it('borderGroup is just the side itself when it has no border', () => {
    expect(borderGroup([], 3)).toEqual([3]);
    expect(borderOn([], 3)).toBeUndefined();
  });
});

describe('making a side standard again', () => {
  it.each(BORDER_STYLES.map((s) => s.id))('%s: removeBorder gives back exactly the outline it started from', (style) => {
    const applied = apply(style, 0, [{ index: 0, code: 'EE' }, { index: 2, code: 'BN' }]);
    const back = removeBorder({ outline: applied.outline, edges: applied.edges }, 0);
    expect(back.ok).toBe(true);
    if (!back.ok) return;
    expect(back.outline).toEqual(rect);
    // The side's own profile and the far side's profile are back where they were.
    expect(back.edges).toEqual([{ index: 0, code: 'EE' }, { index: 2, code: 'BN' }]);
  });

  it('can be started from any side of the border, not just the first', () => {
    const applied = apply('bumpIn');
    const back = removeBorder({ outline: applied.outline, edges: applied.edges }, 3);
    expect(back.ok && back.outline).toEqual(rect);
  });

  it('leaves a neighbouring border alone and lets the freed side take a new one', () => {
    const one = apply('fullRadiusOut', 1);
    const two = applyBorder({ outline: one.outline, edges: one.edges }, 0, 'bumpOut', params, 'b2');
    if (!two.ok) throw new Error(two.error);
    // Side 1 moved to index 5 when side 0 became five sides.
    const freed = removeBorder({ outline: two.outline, edges: two.edges }, 0);
    expect(freed.ok).toBe(true);
    if (!freed.ok) return;
    expect(freed.outline).toEqual(rect);
    expect(freed.edges.map((e) => [e.index, e.borderId])).toEqual([[1, 'b1']]);
    const again = applyBorder({ outline: freed.outline, edges: freed.edges }, 0, 'arcBumpIn', params, 'b3');
    expect(again.ok).toBe(true);
  });

  it('works on the closing side, whose last corner is the first corner', () => {
    const applied = apply('bumpOut', 3);
    const back = removeBorder({ outline: applied.outline, edges: applied.edges }, 5);
    expect(back.ok && back.outline).toEqual(rect);
  });

  it('refuses when the side has no border, or the border was split apart since', () => {
    expect(removeBorder({ outline: rect, edges: [] }, 0)).toEqual({ ok: false, error: 'That side has no border to remove.' });
    const applied = apply('bumpOut');
    const torn = applied.edges.filter((e) => e.index !== 2);
    const result = removeBorder({ outline: applied.outline, edges: torn }, 0);
    expect(result.ok).toBe(false);
  });
});
