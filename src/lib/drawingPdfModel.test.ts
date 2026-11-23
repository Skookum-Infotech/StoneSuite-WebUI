import { describe, expect, it } from 'vitest';
import type { AttachedProfileType, Drawing, EdgeType, Piece } from '@/types/drawing';
import type { DrawingSlabUnit } from '@/types/drawingSlab';
import { ATTACHED_PROFILE_GAP_MM } from './drawing/constants';
import { rectOutline } from './drawing/geometry';
import {
  areaTotals, buildAreaScene, edgeLegend, hexToRgb, pieceTableRows, slabLayouts,
} from './drawingPdfModel';

const EDGE_TYPES: EdgeType[] = [
  { id: 'e1', name: 'Eased', pricingType: 'linear', price: 0, alias: 'E', color: '#2563eb', finish: 'eased', isSystem: true },
  { id: 'e2', name: 'Bullnose', pricingType: 'linear', price: 0, alias: '', color: '#ff0000', finish: 'bullnose', isSystem: true },
];
const PROFILE_TYPES: AttachedProfileType[] = [
  { id: 'p1', name: 'Backsplash', pricingType: 'linear', price: 0, alias: 'BS', color: '#00aa00', measurementPresetsMm: [100], angle: 90, finish: 'none', isSystem: true },
];

function piece(patch: Partial<Piece> = {}): Piece {
  return {
    id: 'p1', label: 'A-1', shape: 'rect', outline: rectOutline(1000, 500), position: { x: 0, y: 0 },
    rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [], ...patch,
  };
}

function drawingOf(pieces: Piece[]): Drawing {
  return {
    schemaVersion: 1, salesOrderId: 'so1', version: 0, displayUnit: 'mm', fractionDenominator: 32,
    areas: [{ id: 'a', name: 'Kitchen', code: '', sortOrder: 0, cabinets: [], notes: [], pieces }],
    updatedAt: '', updatedBy: { id: 'u', name: 'U' },
  };
}

describe('hexToRgb', () => {
  it.each([
    ['#2563eb', [37, 99, 235]],
    ['#26e', [34, 102, 238]],
    ['ff0000', [255, 0, 0]],
    ['not a colour', [28, 25, 23]],
    ['', [28, 25, 23]],
  ])('reads %j as %j', (hex, rgb) => {
    expect(hexToRgb(hex)).toEqual(rgb);
  });
});

describe('buildAreaScene', () => {
  it('has no bounds for an area with nothing in it', () => {
    const drawing = drawingOf([]);
    expect(buildAreaScene(drawing.areas[0], drawing, EDGE_TYPES, PROFILE_TYPES).bounds).toBeNull();
  });

  it('letters every side with its length and points the figure away from the stone', () => {
    const drawing = drawingOf([piece()]);
    const { sides } = buildAreaScene(drawing.areas[0], drawing, EDGE_TYPES, PROFILE_TYPES);
    expect(sides.map((s) => [s.letter, s.text])).toEqual([['A', '1000mm'], ['B', '500mm'], ['C', '1000mm'], ['D', '500mm']]);
    // Side A is the top (y = 0, running +x); the stone is below it, so outward is up.
    expect(sides[0].outward.x).toBeCloseTo(0);
    expect(sides[0].outward.y).toBeCloseTo(1);
  });

  it('gives a painted side its edge colour and leaves the others plain', () => {
    const drawing = drawingOf([piece({ edges: [{ index: 1, edgeTypeId: 'e1' }] })]);
    const { sides } = buildAreaScene(drawing.areas[0], drawing, EDGE_TYPES, PROFILE_TYPES);
    expect(sides.map((s) => s.color)).toEqual([undefined, '#2563eb', undefined, undefined]);
  });

  it('leaves room beyond a side that has a profile piece beside it, and none beside the others', () => {
    const drawing = drawingOf([piece({ edges: [
      { index: 2, attachedProfile: { profileTypeId: 'p1', measurementMm: 100 } },
      { index: 3, attachedProfile: { profileTypeId: 'unknown', measurementMm: 100 } },
    ] })]);
    const { sides } = buildAreaScene(drawing.areas[0], drawing, EDGE_TYPES, PROFILE_TYPES);
    // The profile piece starts a gap out from the side and runs its measurement beyond that;
    // a profile whose type is not in the list is not drawn, so it needs no room.
    expect(sides.map((s) => s.clearanceMm)).toEqual([0, 0, ATTACHED_PROFILE_GAP_MM + 100, 0]);
  });

  it('moves a piece, its seams and its cutouts to where the piece sits', () => {
    const drawing = drawingOf([piece({
      position: { x: 100, y: 200 },
      seams: [{ from: { x: 500, y: 0 }, to: { x: 500, y: -500 } }],
      cutouts: [{ id: 'c1', type: 'sink', shape: 'rect', center: { x: 500, y: -250 }, widthMm: 200, depthMm: 100 }],
    })]);
    const scene = buildAreaScene(drawing.areas[0], drawing, EDGE_TYPES, PROFILE_TYPES);
    expect(scene.seams).toEqual([[{ x: 600, y: 200 }, { x: 600, y: -300 }]]);
    expect(scene.cutouts).toHaveLength(1);
    expect(scene.cutouts[0].map((p) => p.x).sort((a, b) => a - b)).toEqual([500, 500, 700, 700]); // x 400..600 in the piece, plus the piece's 100 offset
    expect(scene.bounds).toEqual({ minX: 100, minY: -300, maxX: 1100, maxY: 200 });
  });

  it('draws no per-side figures on a round top', () => {
    const drawing = drawingOf([piece({ shape: 'circle', radiusMm: 500 })]);
    expect(buildAreaScene(drawing.areas[0], drawing, EDGE_TYPES, PROFILE_TYPES).sides).toEqual([]);
  });

  it('keeps manual dimensions with their length and skips a zero-length one', () => {
    const drawing = drawingOf([piece()]);
    drawing.areas[0].dimensions = [
      { id: 'd1', from: { x: 0, y: 0 }, to: { x: 250, y: 0 }, offsetMm: 50 },
      { id: 'd2', from: { x: 5, y: 5 }, to: { x: 5, y: 5 }, offsetMm: 50 },
    ];
    expect(buildAreaScene(drawing.areas[0], drawing, EDGE_TYPES, PROFILE_TYPES).dimensions.map((d) => d.text)).toEqual(['250mm']);
  });
});

describe('pieceTableRows', () => {
  it('lists size, sq ft, side finishes and grouped cutouts for each piece', () => {
    const drawing = drawingOf([piece({
      edges: [
        { index: 0, edgeTypeId: 'e1' },
        { index: 2, edgeTypeId: 'e2', attachedProfile: { profileTypeId: 'p1', measurementMm: 100 } },
        { index: 3, code: 'BN' },
      ],
      cutouts: [
        { id: 'c1', type: 'sink', center: { x: 200, y: -200 }, widthMm: 100, depthMm: 100 },
        { id: 'c2', type: 'faucet', center: { x: 400, y: -200 }, diameterMm: 30 },
        { id: 'c3', type: 'faucet', center: { x: 500, y: -200 }, diameterMm: 30 },
      ],
    })]);
    expect(pieceTableRows(drawing.areas[0], drawing, EDGE_TYPES, PROFILE_TYPES)).toEqual([[
      'A-1', '1000mm × 500mm', '5.38', 'A E, C Bullnose + BS 100mm, D BN', 'Sink, Faucet ×2',
    ]]);
  });

  it('shows a dash where a piece has no finishes or cutouts', () => {
    const drawing = drawingOf([piece()]);
    expect(pieceTableRows(drawing.areas[0], drawing, EDGE_TYPES, PROFILE_TYPES)[0].slice(3)).toEqual(['—', '—']);
  });
});

describe('edgeLegend', () => {
  it('totals each painted type across pieces and leaves unused types out', () => {
    const drawing = drawingOf([
      piece({ edges: [{ index: 0, edgeTypeId: 'e2' }, { index: 1, edgeTypeId: 'e2' }] }),
      piece({ id: 'p2', label: 'A-2', edges: [{ index: 2, edgeTypeId: 'e2' }] }),
    ]);
    expect(edgeLegend(drawing.areas[0], EDGE_TYPES)).toEqual([
      { name: 'Bullnose', alias: '', color: '#ff0000', lengthMm: 1000 + 500 + 1000 },
    ]);
  });
});

describe('areaTotals', () => {
  it('counts the pieces and adds up their sq ft', () => {
    const drawing = drawingOf([piece(), piece({ id: 'p2', label: 'A-2' })]);
    const totals = areaTotals(drawing.areas[0]);
    expect(totals.pieces).toBe(2);
    expect(totals.sqFt).toBeCloseTo(2 * 5.382, 2);
  });
});

describe('slabLayouts', () => {
  const slab = { id: 's1', serial: 'SL-1', inventoryItemName: 'Calacatta', lengthMm: 3000, widthMm: 1500 } as DrawingSlabUnit;

  it('makes one layout per slab with pieces on it, in slab space', () => {
    const drawing = drawingOf([
      piece({ slab: { slabId: 's1', x: 100, y: 50, rotationDeg: 0 } }),
      piece({ id: 'p2', label: 'A-2' }),
    ]);
    const layouts = slabLayouts(drawing, PROFILE_TYPES, [slab]);
    expect(layouts).toHaveLength(1);
    expect(layouts[0]).toMatchObject({ title: 'Calacatta SL-1', size: '3000mm × 1500mm', lengthMm: 3000, widthMm: 1500 });
    expect(layouts[0].items.map((i) => i.label)).toEqual(['A-1']);
    expect(layouts[0].items[0].outline[0]).toEqual({ x: 100, y: 50 });
  });

  it('leaves out a placement on a slab that is no longer listed', () => {
    const drawing = drawingOf([piece({ slab: { slabId: 'gone', x: 0, y: 0, rotationDeg: 0 } })]);
    expect(slabLayouts(drawing, PROFILE_TYPES, [slab])).toEqual([]);
  });
});
