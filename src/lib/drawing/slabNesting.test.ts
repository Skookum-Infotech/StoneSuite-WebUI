import { describe, expect, it } from 'vitest';
import type { Point, SlabPlacement } from '@/types/drawing';
import { rectOutline } from './geometry';
import { DEFAULT_SLAB_SIZE, estimateSlabs, nestOnSlabs, standardSlab } from './slabNesting';
import type { SlabPlaceable } from './slabPlaceables';
import { placedOutline, usedSlabIds } from './slabs';

/** A rectangle piece of `lengthMm` x `widthMm`; `slab` when it is already laid on one. */
function item(id: string, lengthMm: number, widthMm: number, slab?: SlabPlacement, extra: Partial<SlabPlaceable> = {}): SlabPlaceable {
  return { id, areaId: 'a', pieceId: id, label: id, outline: rectOutline(lengthMm, widthMm), slab, ...extra };
}

const SLAB = { lengthMm: 1000, widthMm: 500 };

function overlaps(a: Point[], b: Point[]): boolean {
  const box = (pts: Point[]) => ({
    x0: Math.min(...pts.map((p) => p.x)), x1: Math.max(...pts.map((p) => p.x)),
    y0: Math.min(...pts.map((p) => p.y)), y1: Math.max(...pts.map((p) => p.y)),
  });
  const A = box(a);
  const B = box(b);
  return Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) > 0.01 && Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) > 0.01;
}

describe('standardSlab', () => {
  it('is the biggest slab the order holds', () => {
    expect(standardSlab([{ lengthMm: 1000, widthMm: 500 }, { lengthMm: 3000, widthMm: 1500 }, { lengthMm: 2000, widthMm: 1000 }]))
      .toEqual({ lengthMm: 3000, widthMm: 1500 });
  });

  it('is a jumbo slab when the order holds none', () => {
    expect(standardSlab([])).toBe(DEFAULT_SLAB_SIZE);
    expect(DEFAULT_SLAB_SIZE).toEqual({ lengthMm: 126 * 25.4, widthMm: 63 * 25.4 });
  });
});

describe('estimateSlabs', () => {
  it('needs no slabs for an empty drawing', () => {
    expect(estimateSlabs([], SLAB)).toEqual({ required: 0, oversize: [] });
  });

  it.each([
    ['one piece', [[400, 500]], 1],
    ['two that share a slab', [[400, 500], [400, 500]], 1],
    ['two too wide to share', [[600, 500], [600, 500]], 2],
    ['three that need two', [[600, 500], [400, 500], [400, 500]], 2],
    ['a piece that fits only on its side', [[500, 1000]], 1],
  ])('%s', (_name, sizes, required) => {
    const items = sizes.map(([l, w], i) => item(`p${i}`, l, w));
    expect(estimateSlabs(items, SLAB).required).toBe(required);
  });

  it('reports a piece bigger than a whole slab instead of counting a slab it could never be cut from', () => {
    const result = estimateSlabs([item('big', 2000, 500), item('ok', 400, 400)], SLAB);
    expect(result.required).toBe(1);
    expect(result.oversize.map((i) => i.id)).toEqual(['big']);
  });

  it('ignores where pieces sit now: placing them all again from scratch', () => {
    const laid = item('p1', 600, 500, { slabId: 's1', x: 0, y: 0, rotationDeg: 0 });
    expect(estimateSlabs([laid, item('p2', 400, 500)], SLAB).required).toBe(1);
  });

  it('does not depend on the order the pieces were drawn in', () => {
    const sizes = [[300, 200], [600, 500], [400, 500], [300, 300], [200, 200]];
    const forward = sizes.map(([l, w], i) => item(`p${i}`, l, w));
    expect(estimateSlabs([...forward].reverse(), SLAB).required).toBe(estimateSlabs(forward, SLAB).required);
  });
});

describe('nestOnSlabs', () => {
  const slabs = [{ id: 's1', ...SLAB }, { id: 's2', ...SLAB }];

  it('lays pieces on the first slab they fit and moves on to the next when it is full', () => {
    const items = [item('a', 600, 500), item('b', 600, 500)];
    const { placements, unplaced } = nestOnSlabs(items, slabs);
    expect(unplaced).toEqual([]);
    expect(placements.map((p) => [p.item.id, p.slab.slabId]).sort()).toEqual([['a', 's1'], ['b', 's2']]);
  });

  it('never lays two pieces over each other', () => {
    const items = ['a', 'b', 'c', 'd'].map((id) => item(id, 400, 250));
    const { placements, unplaced } = nestOnSlabs(items, slabs);
    expect(unplaced).toEqual([]);
    const outlines = placements.map((p) => ({ slabId: p.slab.slabId, outline: placedOutline(p.item, p.slab) }));
    outlines.forEach((x, i) => outlines.slice(i + 1).forEach((y) => {
      if (x.slabId === y.slabId) expect(overlaps(x.outline, y.outline)).toBe(false);
    }));
  });

  it('leaves what is already on a slab where it is, and keeps clear of it', () => {
    const fixed = item('fixed', 600, 500, { slabId: 's1', x: 0, y: 0, rotationDeg: 0 });
    const { placements } = nestOnSlabs([fixed, item('new', 600, 500)], slabs);
    expect(placements.map((p) => p.item.id)).toEqual(['new']);
    expect(placements[0].slab.slabId).toBe('s2');
  });

  it('leaves out what fits on none of the slabs', () => {
    const { placements, unplaced } = nestOnSlabs([item('huge', 2000, 2000), item('fine', 300, 300)], slabs);
    expect(placements.map((p) => p.item.id)).toEqual(['fine']);
    expect(unplaced.map((i) => i.id)).toEqual(['huge']);
  });

  it('keeps a painted profile side apart from its piece, so it can sit on a different slab', () => {
    const profile = item('p1:profile:2', 900, 100, undefined, { pieceId: 'p1', edgeIndex: 2 });
    const { placements } = nestOnSlabs([item('p1', 1000, 400), profile], slabs);
    const byId = Object.fromEntries(placements.map((p) => [p.item.id, p]));
    expect(byId['p1:profile:2'].item.edgeIndex).toBe(2);
    expect(usedSlabIds([{ id: 'x', outline: [], slab: byId.p1.slab }]).has('s1')).toBe(true);
  });

  it('does nothing when there are no slabs', () => {
    const { placements, unplaced } = nestOnSlabs([item('a', 100, 100)], []);
    expect(placements).toEqual([]);
    expect(unplaced.map((i) => i.id)).toEqual(['a']);
  });
});
