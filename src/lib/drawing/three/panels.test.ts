import { describe, expect, it } from 'vitest';
import type { AttachedProfileType, Piece, SlabPlacement } from '@/types/drawing';
import { rectOutline } from '../geometry';
import { slabPlaceables } from '../slabPlaceables';
import { COUNTER_HEIGHT_MM, SPLASH_THICKNESS_MM } from './constants';
import { buildPanels } from './panels';

const BACKSPLASH: AttachedProfileType = {
  id: 'p1', name: 'Backsplash', pricingType: 'linear', price: 12, alias: 'BS', color: '#2563eb',
  measurementPresetsMm: [100], angle: 90, finish: 'none', isSystem: true,
};
const WATERFALL: AttachedProfileType = {
  id: 'p2', name: 'Waterfall', pricingType: 'linear', price: 22, alias: 'WF', color: '#ec4899',
  measurementPresetsMm: [800], angle: 270, finish: 'mitered', isSystem: true,
};
const LAMINATION: AttachedProfileType = {
  id: 'p3', name: 'Lamination', pricingType: 'linear', price: 18, alias: 'LM', color: '#9333ea',
  measurementPresetsMm: [50], angle: 180, finish: 'mitered', isSystem: true,
};
const TYPES = [BACKSPLASH, WATERFALL, LAMINATION];

function piece(edges: Piece['edges']): Piece {
  return {
    id: 'p', label: 'A-1', shape: 'rect', outline: rectOutline(1000, 600), position: { x: 0, y: 0 },
    rotationDeg: 0, thicknessMm: 30, edges, seams: [], cutouts: [],
  };
}

describe('buildPanels', () => {
  it('makes nothing when no side has a painted profile', () => {
    expect(buildPanels(piece([{ index: 0, code: 'E' }]), 30, TYPES)).toEqual([]);
  });

  it('makes nothing when the painted type is not in the list', () => {
    expect(buildPanels(piece([{ index: 0, attachedProfile: { profileTypeId: 'gone', measurementMm: 100 } }]), 30, TYPES)).toEqual([]);
  });

  it('stands a 90deg (upright) profile on the counter, set in towards the middle of the piece', () => {
    // Side 0 runs (0,0) -> (1000,0); the stone lies below it (y < 0), so "in" is -y.
    const [splash] = buildPanels(piece([{ index: 0, attachedProfile: { profileTypeId: 'p1', measurementMm: 100 } }]), 30, TYPES);
    expect(splash.kind).toBe('upright');
    expect(splash.baseMm).toBe(COUNTER_HEIGHT_MM);
    expect(splash.heightMm).toBe(100);
    expect(splash.footprint.map((p) => p.y)).toEqual([0, 0, -SPLASH_THICKNESS_MM, -SPLASH_THICKNESS_MM]);
  });

  it('drops a 270deg (dropped) profile from the top face down, as thick as the slab', () => {
    const [fall] = buildPanels(piece([{ index: 1, attachedProfile: { profileTypeId: 'p2', measurementMm: 800 } }]), 30, TYPES);
    expect(fall.kind).toBe('dropped');
    expect(fall.baseMm).toBe(COUNTER_HEIGHT_MM - 800);
    expect(fall.heightMm).toBe(800);
    // Side 1 is the right-hand side (x = 1000); inward is -x, 30 mm deep.
    expect(Math.min(...fall.footprint.map((p) => p.x))).toBeCloseTo(970);
  });

  it('builds a 180deg (flat) profile as thick as the slab, extending out by its measurement', () => {
    const [lam] = buildPanels(piece([{ index: 1, attachedProfile: { profileTypeId: 'p3', measurementMm: 50 } }]), 30, TYPES);
    expect(lam.kind).toBe('flat');
    expect(lam.baseMm).toBe(COUNTER_HEIGHT_MM - 30);
    expect(lam.heightMm).toBe(30);
    expect(Math.min(...lam.footprint.map((p) => p.x))).toBeCloseTo(950);
  });

  it('follows a curved side with several walls', () => {
    const many = buildPanels(piece([{ index: 0, attachedProfile: { profileTypeId: 'p1', measurementMm: 100 }, arcHeightMm: 120 }]), 30, TYPES);
    expect(many.length).toBeGreaterThan(1);
  });

  it('moves with the piece', () => {
    const moved = { ...piece([{ index: 0, attachedProfile: { profileTypeId: 'p1', measurementMm: 100 } }]), position: { x: 500, y: 200 } };
    const [splash] = buildPanels(moved, 30, TYPES);
    expect(splash.footprint[0]).toEqual({ x: 500, y: 200 });
  });

  describe('slab photo', () => {
    const SLAB = { photoUrl: 'https://x/s1.jpg', lengthMm: 3000, widthMm: 1500 };
    const PLACEMENT: SlabPlacement = { slabId: 's1', x: 0, y: 0, rotationDeg: 0 };

    it('is null until the painted side is placed on a photographed slab', () => {
      const [splash] = buildPanels(piece([{ index: 0, attachedProfile: { profileTypeId: 'p1', measurementMm: 100 } }]), 30, TYPES);
      expect(splash.texture).toBeNull();
    });

    it('resolves for an upright/dropped panel once its own side is placed and fits', () => {
      const withSlab = piece([{ index: 0, attachedProfile: { profileTypeId: 'p1', measurementMm: 100, slab: PLACEMENT } }]);
      const placeables = slabPlaceables([{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces: [withSlab], cabinets: [], notes: [] }], TYPES);
      const [splash] = buildPanels(withSlab, 30, TYPES, placeables, { s1: SLAB });
      expect(splash.texture?.photoUrl).toBe(SLAB.photoUrl);
      expect(splash.texture?.flipV).toBe(false);
    });

    it('a flat (lamination) panel never gets one — its visible face is a raw edge, not a photographed surface', () => {
      const withSlab = piece([{ index: 1, attachedProfile: { profileTypeId: 'p3', measurementMm: 50, slab: PLACEMENT } }]);
      const placeables = slabPlaceables([{ id: 'a', name: 'A', code: '', sortOrder: 0, pieces: [withSlab], cabinets: [], notes: [] }], TYPES);
      const [lam] = buildPanels(withSlab, 30, TYPES, placeables, { s1: SLAB });
      expect(lam.kind).toBe('flat');
      expect(lam.texture).toBeNull();
    });
  });
});
