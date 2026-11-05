import { describe, expect, it } from 'vitest';
import type { Cutout, Piece } from '@/types/drawing';
import { lShapeOutline, rectOutline } from './geometry';
import { areaMetrics, mm2ToSqFt, pieceMetrics } from './metrics';

const piece = (outline = rectOutline(2000, 600), cutouts: Cutout[] = []): Piece => ({
  id: 'p', label: 'A-1', shape: 'rect', outline, position: { x: 0, y: 0 }, rotationDeg: 0,
  thicknessMm: 30, edges: [], seams: [], cutouts,
});
const sink: Cutout = { id: 's', type: 'sink', shape: 'rect', center: { x: 1000, y: -300 }, widthMm: 800, depthMm: 400 };

describe('pieceMetrics', () => {
  it('reports gross, cutout and net area, perimeter and each edge', () => {
    const m = pieceMetrics(piece(rectOutline(2000, 600), [sink]));
    expect(m.grossAreaMm2).toBe(1_200_000);
    expect(m.cutoutAreaMm2).toBeCloseTo(320_000);
    expect(m.netAreaMm2).toBeCloseTo(880_000);
    expect(m.perimeterMm).toBe(5200);
    expect(m.edges.map((e) => e.lengthMm)).toEqual([2000, 600, 2000, 600]);
    m.edges.forEach((e) => expect(e.startAngleDeg).toBeCloseTo(90));
  });

  it('has no cutout area without cutouts', () => {
    const m = pieceMetrics(piece());
    expect(m.cutoutAreaMm2).toBe(0);
    expect(m.netAreaMm2).toBe(m.grossAreaMm2);
  });

  it('works for non-rectangular shapes', () => {
    const m = pieceMetrics(piece(lShapeOutline(1000, 600, 400, 300)));
    expect(m.grossAreaMm2).toBe(1000 * 600 - 400 * 300);
    expect(m.edges).toHaveLength(6);
  });

  it('never reports a negative net area', () => {
    const huge: Cutout = { ...sink, widthMm: 5000, depthMm: 5000 };
    expect(pieceMetrics(piece(rectOutline(100, 100), [huge])).netAreaMm2).toBe(0);
  });
});

describe('areaMetrics', () => {
  it('sums pieces and counts cutouts', () => {
    const m = areaMetrics([piece(rectOutline(2000, 600), [sink]), piece()]);
    expect(m.pieceCount).toBe(2);
    expect(m.cutoutCount).toBe(1);
    expect(m.grossAreaMm2).toBe(2_400_000);
    expect(m.netAreaMm2).toBeCloseTo(2_080_000);
  });
});

describe('mm2ToSqFt', () => {
  it('converts square millimetres to square feet', () => {
    expect(mm2ToSqFt(92903.04)).toBeCloseTo(1);
  });
});
