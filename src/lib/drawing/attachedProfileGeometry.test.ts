import { describe, expect, it } from 'vitest';
import type { AttachedProfileType, Piece } from '@/types/drawing';
import { attachedProfilePieces } from './attachedProfileGeometry';
import { rectOutline } from './geometry';

const BACKSPLASH: AttachedProfileType = {
  id: 'p1', name: 'Backsplash', pricingType: 'linear', price: 12, alias: 'BS', color: '#2563eb',
  measurementPresetsMm: [100], angle: 90, finish: 'none', isSystem: true,
};
const LAMINATION: AttachedProfileType = {
  id: 'p2', name: 'Lamination', pricingType: 'linear', price: 18, alias: 'LM', color: '#9333ea',
  measurementPresetsMm: [50], angle: 180, finish: 'mitered', isSystem: true,
};
const MITER_EDGE: AttachedProfileType = {
  id: 'p3', name: 'Miter Edge', pricingType: 'linear', price: 15, alias: 'ME', color: '#f59e0b',
  measurementPresetsMm: [40], angle: 90, finish: 'mitered', isSystem: true,
};
const TYPES = [BACKSPLASH, LAMINATION, MITER_EDGE];

const piece = (): Piece => ({
  id: 'p1', label: 'C1', shape: 'rect', outline: rectOutline(1000, 600), position: { x: 0, y: 0 }, rotationDeg: 0,
  thicknessMm: 30, seams: [], cutouts: [],
  edges: [
    { index: 0, attachedProfile: { profileTypeId: 'p1', measurementMm: 100 } },
    { index: 1, attachedProfile: { profileTypeId: 'p2', measurementMm: 50 } },
    { index: 2, attachedProfile: { profileTypeId: 'p3', measurementMm: 40 } },
  ],
});

describe('attachedProfilePieces', () => {
  it('builds an unfolded rectangle offset outward from each painted side', () => {
    const [bs] = attachedProfilePieces(piece(), TYPES);
    expect(bs.index).toBe(0);
    expect(bs.label).toBe('C1 Backsplash-A');
    expect(bs.lengthMm).toBe(1000);
    expect(bs.widthMm).toBe(100);
    expect(bs.color).toBe('#2563eb');
    // Side 0 runs (0,0) -> (1000,0); outward is +y, offset by the gap then the width.
    expect(bs.outline).toEqual([
      { x: 0, y: 101.6 }, { x: 1000, y: 101.6 }, { x: 1000, y: 201.6 }, { x: 0, y: 201.6 },
    ]);
  });

  it('carries the parent\'s own (un-offset) border for this side, for the attach band and arrow', () => {
    const [bs] = attachedProfilePieces(piece(), TYPES);
    expect(bs.parentEdge).toEqual([{ x: 0, y: 0 }, { x: 1000, y: 0 }]);
  });

  it('names the second painted side with its own side letter', () => {
    const pieces = attachedProfilePieces(piece(), TYPES);
    expect(pieces[1].label).toBe('C1 Lamination-B');
  });

  it('flags a corner as mitered only when both sides meeting there are a mitered finish', () => {
    const [bs, lam, miter] = attachedProfilePieces(piece(), TYPES);
    // Backsplash (none finish) is never mitered, whatever its neighbours are.
    expect(bs.miteredStart).toBe(false);
    expect(bs.miteredEnd).toBe(false);
    // Lamination-B meets Backsplash-A (not mitered) at its start, and Miter Edge-C (mitered) at its end.
    expect(lam.miteredStart).toBe(false);
    expect(lam.miteredEnd).toBe(true);
    // Miter Edge-C meets Lamination-B (mitered) at its start, and an unpainted side at its end.
    expect(miter.miteredStart).toBe(true);
    expect(miter.miteredEnd).toBe(false);
  });

  it('skips a side whose profile type is not in the list', () => {
    const p = piece();
    expect(attachedProfilePieces(p, [LAMINATION, MITER_EDGE])).toHaveLength(2);
  });

  it('is empty for a piece with no painted sides', () => {
    const p = piece();
    p.edges = [];
    expect(attachedProfilePieces(p, TYPES)).toEqual([]);
  });
});
