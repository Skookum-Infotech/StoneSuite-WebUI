import { describe, expect, it } from 'vitest';
import type { Piece, Point, SlabPlacement } from '@/types/drawing';
import { attachedProfileLocalOutline } from '../attachedProfileGeometry';
import { placedOutline } from '../slabs';
import { panelSlabUv, resolvePanelTexture, type PanelTexture } from './panelTexture';
import type { SlabPhoto } from './slabTexture';

const SLAB: SlabPhoto = { photoUrl: 'https://x/s1.jpg', lengthMm: 3000, widthMm: 1500 };
const PLACEMENT: SlabPlacement = { slabId: 's1', x: 0, y: 0, rotationDeg: 0 };

function piece(overrides: Partial<Piece> = {}): Piece {
  return {
    id: 'p1', label: 'A-1', shape: 'rect', outline: [{ x: 0, y: 0 }, { x: 1000, y: 0 }, { x: 1000, y: -600 }, { x: 0, y: -600 }],
    position: { x: 0, y: 0 }, rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
    ...overrides,
  };
}

describe('resolvePanelTexture', () => {
  it('is null when the side has no slab placement', () => {
    expect(resolvePanelTexture(piece(), 0, 100, undefined, { s1: SLAB }, [], false)).toBeNull();
  });

  it('is null when the placed slab has no photo loaded yet', () => {
    expect(resolvePanelTexture(piece(), 0, 100, PLACEMENT, {}, [], false)).toBeNull();
  });

  it('is null when the placement no longer fits the slab', () => {
    const tooWide = { ...PLACEMENT, x: 2900 }; // 1000mm long, 2900+1000 > 3000mm slab
    expect(resolvePanelTexture(piece(), 0, 100, tooWide, { s1: SLAB }, [], false)).toBeNull();
  });

  it('resolves once placed and fitting, carrying the local outline and offset', () => {
    const texture = resolvePanelTexture(piece(), 0, 100, PLACEMENT, { s1: SLAB }, [], false);
    expect(texture).not.toBeNull();
    expect(texture?.photoUrl).toBe(SLAB.photoUrl);
    expect(texture?.localOutline).toEqual(attachedProfileLocalOutline(piece().outline, 0, 100));
    expect(texture?.flipV).toBe(false);
  });
});

describe('panelSlabUv', () => {
  const localOutline = attachedProfileLocalOutline(piece().outline, 0, 100) as Point[];

  it('agrees with placedOutline at every corner — the same point placed two different ways', () => {
    const texture: PanelTexture = {
      ...SLAB,
      localOutline: localOutline as PanelTexture['localOutline'],
      offset: { x: 0, y: 201.6 }, // slabOffset({ outline: localOutline }, PLACEMENT)
      slabRotationDeg: 0,
      flipV: false,
    };
    const onSlab = placedOutline({ outline: localOutline }, PLACEMENT);
    // near(a) (length-fraction 0, height-fraction 0) is onSlab[0]; far(a) (length-fraction 0,
    // height-fraction 1) is onSlab[3] — the other end of the same side (width direction).
    const [uNear, vNear] = panelSlabUv(0, 0, texture);
    expect(uNear).toBeCloseTo(onSlab[0].x / SLAB.lengthMm);
    expect(vNear).toBeCloseTo(1 - onSlab[0].y / SLAB.widthMm);
    const [uFar, vFar] = panelSlabUv(0, 1, texture);
    expect(uFar).toBeCloseTo(onSlab[3].x / SLAB.lengthMm);
    expect(vFar).toBeCloseTo(1 - onSlab[3].y / SLAB.widthMm);
  });

  it('flips v for a dropped panel, so its base (at the counter) and its drop read the opposite way round from an upright one', () => {
    const base: Omit<PanelTexture, 'flipV'> = {
      ...SLAB, localOutline: localOutline as PanelTexture['localOutline'], offset: { x: 0, y: 201.6 }, slabRotationDeg: 0,
    };
    const upright = panelSlabUv(0.5, 0.25, { ...base, flipV: false });
    const dropped = panelSlabUv(0.5, 0.75, { ...base, flipV: true });
    expect(upright).toEqual(dropped);
  });
});
