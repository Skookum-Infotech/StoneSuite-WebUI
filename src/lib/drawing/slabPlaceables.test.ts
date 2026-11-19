import { describe, expect, it } from 'vitest';
import type { AttachedProfileType, DrawingArea, Piece } from '@/types/drawing';
import { bounds } from './geometry';
import { profilePlaceableId, slabPlaceables } from './slabPlaceables';

const BACKSPLASH: AttachedProfileType = {
  id: 'p1', name: 'Backsplash', pricingType: 'linear', price: 12, alias: 'BS', color: '#2563eb',
  measurementPresetsMm: [100], angle: 90, finish: 'none', isSystem: true,
};
const TYPES = [BACKSPLASH];

function piece(id: string, overrides: Partial<Piece> = {}): Piece {
  return {
    id, label: id, shape: 'rect', outline: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: -600 }, { x: 0, y: -600 }],
    position: { x: 500, y: 300 }, rotationDeg: 45, thicknessMm: 30, edges: [], seams: [], cutouts: [],
    ...overrides,
  };
}

function area(pieces: Piece[]): DrawingArea {
  return { id: 'a1', name: 'Kitchen', code: 'K', sortOrder: 0, pieces, cabinets: [], notes: [] };
}

describe('slabPlaceables', () => {
  it('includes every piece, with its own id, outline and slab', () => {
    const p = piece('p1', { slab: { slabId: 's1', x: 0, y: 0, rotationDeg: 0 } });
    const [placeable] = slabPlaceables([area([p])], TYPES);
    expect(placeable).toEqual({
      id: 'p1', areaId: 'a1', pieceId: 'p1', label: 'p1', outline: p.outline, edges: [], slab: p.slab,
    });
  });

  it('adds one placeable per painted side, in the piece\'s own local space', () => {
    const p = piece('p1', { edges: [{ index: 0, attachedProfile: { profileTypeId: 'p1', measurementMm: 100 } }] });
    const placeables = slabPlaceables([area([p])], TYPES);
    expect(placeables).toHaveLength(2);
    const profile = placeables[1];
    expect(profile.id).toBe(profilePlaceableId('p1', 0));
    expect(profile.label).toBe('p1 Backsplash-A');
    expect(profile.edgeIndex).toBe(0);
    // Local space: unaffected by the piece's own position/rotation on the board.
    expect(bounds(profile.outline)).toEqual({ minX: 0, maxX: 1000, minY: 101.6, maxY: 201.6 });
  });

  it('carries a painted side\'s own slab placement, independent of the parent piece\'s', () => {
    const p = piece('p1', {
      slab: { slabId: 'parent-slab', x: 0, y: 0, rotationDeg: 0 },
      edges: [{ index: 0, attachedProfile: { profileTypeId: 'p1', measurementMm: 100, slab: { slabId: 's2', x: 5, y: 5, rotationDeg: 0 } } }],
    });
    const [pieceItem, profileItem] = slabPlaceables([area([p])], TYPES);
    expect(pieceItem.slab?.slabId).toBe('parent-slab');
    expect(profileItem.slab?.slabId).toBe('s2');
  });

  it('skips a painted side whose type is not in the list', () => {
    const p = piece('p1', { edges: [{ index: 0, attachedProfile: { profileTypeId: 'unknown', measurementMm: 100 } }] });
    expect(slabPlaceables([area([p])], TYPES)).toHaveLength(1);
  });
});
