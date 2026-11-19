import { describe, expect, it } from 'vitest';
import type { AttachedProfileType, Cutout, DrawingArea, Piece } from '@/types/drawing';
import { rectOutline } from '../geometry';
import { COUNTER_HEIGHT_MM, DEFAULT_PIECE_THICKNESS_MM } from './constants';
import { buildAreaSolids } from './solids';

function piece(overrides: Partial<Piece> = {}): Piece {
  return {
    id: 'p1', label: 'A-1', shape: 'rect', outline: rectOutline(1000, 600), position: { x: 0, y: 0 },
    rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [], ...overrides,
  };
}

function area(pieces: Piece[]): DrawingArea {
  return { id: 'a', name: 'Area', code: '', sortOrder: 0, pieces, cabinets: [], notes: [] };
}

const sink: Cutout = { id: 'c1', type: 'sink', shape: 'rect', center: { x: 500, y: -300 }, widthMm: 400, depthMm: 300 };

describe('buildAreaSolids', () => {
  it('returns empty, non-degenerate bounds for no area or no pieces', () => {
    for (const input of [undefined, area([])]) {
      const result = buildAreaSolids(input);
      expect(result.pieces).toEqual([]);
      expect(result.skipped).toBe(0);
      expect(result.bounds.sizeMm).toBeGreaterThan(0);
    }
  });

  it('keeps the outline in world space and puts the top face at counter height', () => {
    const [solid] = buildAreaSolids(area([piece({ position: { x: 100, y: 50 } })])).pieces;
    expect(solid.outline[0]).toEqual({ x: 100, y: 50 });
    expect(solid.outline[1]).toEqual({ x: 1100, y: 50 });
    expect(solid.baseMm + solid.thicknessMm).toBe(COUNTER_HEIGHT_MM);
  });

  it('rotates the outline clockwise like the 2D board', () => {
    const [solid] = buildAreaSolids(area([piece({ rotationDeg: 90 })])).pieces;
    // (1000, 0) turned 90 degrees clockwise (y-up) is (0, -1000).
    expect(solid.outline[1].x).toBeCloseTo(0);
    expect(solid.outline[1].y).toBeCloseTo(-1000);
  });

  it('falls back to a default thickness when the piece has none', () => {
    const [solid] = buildAreaSolids(area([piece({ thicknessMm: 0 })])).pieces;
    expect(solid.thicknessMm).toBe(DEFAULT_PIECE_THICKNESS_MM);
  });

  it('turns cutouts inside the stone into holes, and drops ones that leave it', () => {
    const outside: Cutout = { ...sink, id: 'c2', center: { x: 5000, y: 0 } };
    const [solid] = buildAreaSolids(area([piece({ cutouts: [sink, outside] })])).pieces;
    expect(solid.holes).toHaveLength(1);
  });

  it('samples curved sides into extra outline points', () => {
    const edges = [{ index: 0, arcHeightMm: 100 }];
    const [solid] = buildAreaSolids(area([piece({ edges })])).pieces;
    expect(solid.outline.length).toBeGreaterThan(4);
  });

  it('skips pieces whose outline crosses itself or is too short, and counts them', () => {
    const bowtie = [{ x: 0, y: 0 }, { x: 100, y: -100 }, { x: 100, y: 0 }, { x: 0, y: -100 }];
    const result = buildAreaSolids(area([piece({ id: 'bad', outline: bowtie }), piece({ id: 'short', outline: bowtie.slice(0, 2) }), piece()]));
    expect(result.pieces.map((p) => p.id)).toEqual(['p1']);
    expect(result.skipped).toBe(2);
  });

  it('adds attached-profile walls and cuts seams back to the stone', () => {
    const backsplash: AttachedProfileType = {
      id: 'bs1', name: 'Backsplash', pricingType: 'linear', price: 0, alias: '', color: '#000000',
      measurementPresetsMm: [100], angle: 90, finish: 'none', isSystem: false,
    };
    const seam = { from: { x: 500, y: 100 }, to: { x: 500, y: -700 } };
    const edges = [{ index: 0, attachedProfile: { profileTypeId: 'bs1', measurementMm: 100 } }];
    const withPanel = piece({ edges, seams: [seam] });
    const [solid] = buildAreaSolids(area([withPanel]), { allPieces: [withPanel], photos: {}, profileTypes: [backsplash] }).pieces;
    expect(solid.panels).toHaveLength(1);
    expect(solid.seams).toHaveLength(1);
    expect(solid.seams[0][0].y).toBeCloseTo(0);
    expect(solid.seams[0][1].y).toBeCloseTo(-600);
  });

  it('gives a piece its slab photo only when the context says it fits', () => {
    const onSlab = piece({ slab: { slabId: 's1', x: 0, y: 0, rotationDeg: 0 } });
    const context = { allPieces: [onSlab], photos: { s1: { photoUrl: 'https://x/s1.jpg', lengthMm: 3000, widthMm: 1500 } } };
    expect(buildAreaSolids(area([onSlab]), context).pieces[0].texture).not.toBeNull();
    expect(buildAreaSolids(area([onSlab])).pieces[0].texture).toBeNull();
  });

  it('lists cabinets tucked under the thickest slab, dropping unusable outlines', () => {
    const cabinet = [{ x: 0, y: 0 }, { x: 600, y: 0 }, { x: 600, y: -600 }, { x: 0, y: -600 }];
    const result = buildAreaSolids({ ...area([piece({ thicknessMm: 40 })]), cabinets: [cabinet, cabinet.slice(0, 2)] });
    expect(result.cabinets).toHaveLength(1);
    expect(result.cabinets[0].heightMm).toBe(COUNTER_HEIGHT_MM - 40);
  });

  it('reads each side finish from its painted edge type, or null when every side is square', () => {
    const bullnose = { id: 't1', name: 'Bullnose', pricingType: 'linear', price: 1, alias: '', color: '#000000', finish: 'bullnose', isSystem: false } as const;
    const plain = { ...bullnose, id: 't2', finish: 'none' } as const;
    const painted = piece({ edges: [{ index: 1, edgeTypeId: 't1' }] });
    const [solid] = buildAreaSolids(area([painted]), { allPieces: [painted], photos: {}, edgeTypes: [bullnose, plain] }).pieces;
    expect(solid.segmentFinishes).toEqual(['none', 'bullnose', 'none', 'none']);
    const square = piece({ edges: [{ index: 1, edgeTypeId: 't2' }] });
    expect(buildAreaSolids(area([square]), { allPieces: [square], photos: {}, edgeTypes: [bullnose, plain] }).pieces[0].segmentFinishes).toBeNull();
    expect(buildAreaSolids(area([painted])).pieces[0].segmentFinishes).toBeNull();
  });

  it('gives only sink openings a bowl', () => {
    const cooktop: Cutout = { ...sink, id: 'c3', type: 'cooktop', center: { x: 200, y: -300 }, widthMm: 100, depthMm: 100 };
    const [solid] = buildAreaSolids(area([piece({ cutouts: [sink, cooktop] })])).pieces;
    expect(solid.holes).toHaveLength(2);
    expect(solid.bowls).toHaveLength(1);
  });

  it('centres the bounds on every piece in the area', () => {
    const result = buildAreaSolids(area([piece(), piece({ id: 'p2', position: { x: 2000, y: 0 } })]));
    expect(result.bounds.centerX).toBeCloseTo(1500);
    expect(result.bounds.sizeMm).toBeCloseTo(3000);
  });
});
