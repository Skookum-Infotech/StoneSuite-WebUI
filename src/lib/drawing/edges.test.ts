import { describe, expect, it } from 'vitest';
import type { PieceEdge } from '@/types/drawing';
import { addEdgeTotals, edgeAt, edgeSettingsProblem, edgeTotals, setEdgeSettings } from './edges';

const rect = [{ x: 0, y: 100 }, { x: 1000, y: 100 }, { x: 1000, y: 0 }, { x: 0, y: 0 }];

describe('setEdgeSettings', () => {
  it('creates an entry, merges later patches and keeps sides sorted', () => {
    let edges: PieceEdge[] = [];
    edges = setEdgeSettings(edges, 2, { code: 'BN' });
    edges = setEdgeSettings(edges, 0, { splashHeightMm: 100 });
    edges = setEdgeSettings(edges, 2, { overhangMm: 25 });
    expect(edges).toEqual([{ index: 0, splashHeightMm: 100 }, { index: 2, code: 'BN', overhangMm: 25 }]);
  });
  it('clears a key and drops a side left with no settings', () => {
    const edges = setEdgeSettings([{ index: 1, code: 'EE' }], 1, { code: undefined });
    expect(edges).toEqual([]);
  });
  it('does not mutate its input', () => {
    const edges: PieceEdge[] = [{ index: 0, code: 'EE' }];
    setEdgeSettings(edges, 0, { code: 'BN' });
    expect(edges).toEqual([{ index: 0, code: 'EE' }]);
  });
  it('edgeAt returns an empty side when none is stored', () => {
    expect(edgeAt([], 3)).toEqual({ index: 3 });
  });
});

describe('edgeSettingsProblem', () => {
  it.each([
    [{ overhangMm: -1 }, 'Overhang cannot be negative.'],
    [{ splashHeightMm: Number.NaN }, 'Backsplash height cannot be negative.'],
    [{ waterfallHeightMm: 1e9 }, 'Waterfall height is too large.'],
    [{ overhangMm: 0 }, null],
    [{ code: 'BN' }, null],
  ])('%j -> %s', (patch, expected) => {
    expect(edgeSettingsProblem(patch)).toBe(expected);
  });
});

describe('edgeTotals', () => {
  it('sums finished length per code and splash / waterfall area from real side lengths', () => {
    const t = edgeTotals({
      outline: rect,
      edges: [
        { index: 0, code: 'EE', splashHeightMm: 100 },
        { index: 1, code: 'EE', waterfallHeightMm: 900 },
        { index: 2, code: 'BN' },
      ],
    });
    expect(t.finishedByCode).toEqual({ EE: 1100, BN: 1000 });
    expect(t.finishedLengthMm).toBe(2100);
    expect(t.splashAreaMm2).toBe(100000);
    expect(t.waterfallAreaMm2).toBe(90000);
    expect(t.waterfallLengthMm).toBe(100);
  });
  it('ignores entries for sides that no longer exist', () => {
    expect(edgeTotals({ outline: rect, edges: [{ index: 9, code: 'EE' }] }).finishedLengthMm).toBe(0);
  });
  it('adds totals together', () => {
    const one = edgeTotals({ outline: rect, edges: [{ index: 0, code: 'EE' }] });
    expect(addEdgeTotals(one, one).finishedByCode).toEqual({ EE: 2000 });
  });
});
