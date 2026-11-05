import { describe, expect, it } from 'vitest';
import type { DrawingArea, Piece } from '@/types/drawing';
import { rectOutline } from './geometry';
import { materialUsage } from './materials';

const piece = (id: string, extra: Partial<Piece> = {}): Piece => ({
  id, label: id, shape: 'rect', outline: rectOutline(1000, 500), position: { x: 0, y: 0 }, rotationDeg: 0,
  thicknessMm: 30, edges: [], seams: [], cutouts: [], ...extra,
});
const area = (pieces: Piece[]): DrawingArea => ({ id: 'a', name: 'A', code: '', sortOrder: 0, pieces, cabinets: [], notes: [] });

describe('materialUsage', () => {
  it('groups pieces by line across areas, with unassigned pieces last', () => {
    const usage = materialUsage([
      area([piece('p1'), piece('p2', { salesOrderLineId: 'L1' })]),
      area([piece('p3', { salesOrderLineId: 'L1' }), piece('p4', { salesOrderLineId: 'L2' })]),
    ]);
    expect(usage.map((u) => [u.lineId, u.pieceCount])).toEqual([['L1', 2], ['L2', 1], [null, 1]]);
    expect(usage[0].grossAreaMm2).toBe(1_000_000);
  });

  it('adds backsplash and waterfall panels to billable area but not cutouts', () => {
    const [u] = materialUsage([area([piece('p1', {
      salesOrderLineId: 'L1',
      edges: [{ index: 0, splashHeightMm: 100 }, { index: 1, waterfallHeightMm: 900 }],
      cutouts: [{ id: 'c', type: 'sink', shape: 'rect', center: { x: 500, y: -250 }, widthMm: 300, depthMm: 200 }],
    })])]);
    expect(u.verticalAreaMm2).toBe(100_000 + 450_000);
    expect(u.billableAreaMm2).toBe(500_000 + 550_000);
    expect(u.netAreaMm2).toBe(500_000 - 60_000);
  });

  it('is empty for an empty drawing', () => {
    expect(materialUsage([area([])])).toEqual([]);
  });
});
