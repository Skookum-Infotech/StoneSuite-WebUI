import { describe, expect, it } from 'vitest';
import type { Cutout, Piece } from '@/types/drawing';
import { lShapeOutline, rectOutline } from './geometry';
import { areaMetrics, fabricationSqFt, mm2ToSqFt, pieceMetrics } from './metrics';

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

  it('counts a bowed side in the area, the perimeter and the finished edge length', () => {
    // The 600 mm side (index 1) bowed out by half its length is a half circle of radius 300.
    const bowed = { ...piece(), edges: [{ index: 1, code: 'EE', arcHeightMm: 300 }] };
    const m = pieceMetrics(bowed);
    expect(m.grossAreaMm2).toBeCloseTo(1_200_000 + (Math.PI * 300 * 300) / 2);
    expect(m.perimeterMm).toBeCloseTo(5200 - 600 + Math.PI * 300);
    expect(m.edgeTotals.finishedLengthMm).toBeCloseTo(Math.PI * 300);
    // The side's own length stays the straight line across it, the way the drawing labels it.
    expect(m.edges[1].lengthMm).toBe(600);
  });

  it('takes a bowed-in side out of the area', () => {
    const m = pieceMetrics({ ...piece(), edges: [{ index: 1, arcHeightMm: -300 }] });
    expect(m.grossAreaMm2).toBeCloseTo(1_200_000 - (Math.PI * 300 * 300) / 2);
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

describe('fabricationSqFt', () => {
  it.each([
    [100, 20, 120],
    [100, 0, 100],
    [58.252, 20, 69.9024],
    [50, 100, 100],
  ])('countertop %s sq ft at %s%% -> %s sq ft', (countertopSqFt, percent, want) => {
    expect(fabricationSqFt(countertopSqFt, percent)).toBeCloseTo(want);
  });
});
