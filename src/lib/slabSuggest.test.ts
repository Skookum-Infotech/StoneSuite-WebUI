import { describe, it, expect } from 'vitest';
import { suggestSlabs, type SlabCandidate } from './slabSuggest';

const slabs = (...areas: number[]): SlabCandidate[] => areas.map((area, i) => ({ id: `s${i + 1}`, area }));
const ids = (c: SlabCandidate[], shortfall: number) => suggestSlabs(c, shortfall).ids;

describe('suggestSlabs', () => {
  it('needs nothing when nothing is short', () => {
    expect(suggestSlabs(slabs(45, 45), 0)).toEqual({ ids: [], total: 0, covers: true });
    expect(suggestSlabs(slabs(45), -3)).toEqual({ ids: [], total: 0, covers: true });
  });

  it('uses the smallest single slab that covers the gap, not the biggest', () => {
    // 50, 30 and 20 are all in stock; a 25 gap is best met by the 30.
    expect(ids(slabs(50, 30, 20), 25)).toEqual(['s2']);
  });

  it('accepts a slab that covers the gap exactly', () => {
    expect(ids(slabs(50, 30, 20), 30)).toEqual(['s2']);
  });

  it('takes the biggest slabs first when no one slab is enough, finishing with the best fit', () => {
    // Gap 70: no single slab covers it. 50 leaves 20, and the 20 covers that
    // exactly rather than the 30.
    expect(ids(slabs(50, 30, 20), 70)).toEqual(['s1', 's3']);
  });

  it('keeps taking slabs until the gap is covered', () => {
    // Gap 100 from 45s: 45 + 45 leaves 10, finished by the third 45.
    const s = suggestSlabs(slabs(45, 45, 45, 45), 100);
    expect(s.ids).toHaveLength(3);
    expect(s.total).toBe(135);
    expect(s.covers).toBe(true);
  });

  it('reports partial cover, and offers everything, when the stock is not enough', () => {
    const s = suggestSlabs(slabs(30, 20), 80);

    expect(s.covers).toBe(false);
    expect(s.total).toBe(50);
    expect([...s.ids].sort()).toEqual(['s1', 's2']);
  });

  it('offers nothing, uncovered, when there are no slabs at all', () => {
    expect(suggestSlabs([], 10)).toEqual({ ids: [], total: 0, covers: false });
  });

  it('ignores slabs with no area', () => {
    expect(ids(slabs(0, 40), 30)).toEqual(['s2']);
  });

  it('does not change the list it was given', () => {
    const input = slabs(50, 30, 20);
    suggestSlabs(input, 70);

    expect(input.map((c) => c.id)).toEqual(['s1', 's2', 's3']);
  });

  it('is not thrown by float noise at the boundary', () => {
    expect(suggestSlabs(slabs(32.292), 32.2920000001).covers).toBe(true);
  });
});
