import { describe, expect, it } from 'vitest';
import type { DrawingArea, Piece } from '@/types/drawing';
import { rectOutline } from './geometry';
import { measurementSummary } from './measurementSummary';

const piece = (id: string, label: string, outline = rectOutline(2000, 600)): Piece => ({
  id, label, shape: 'rect', outline, position: { x: 0, y: 0 }, rotationDeg: 0,
  thicknessMm: 30, edges: [], seams: [], cutouts: [],
});

const area = (id: string, name: string, pieces: Piece[]): DrawingArea => ({
  id, name, code: '', sortOrder: 0, pieces, cabinets: [], notes: [],
});

describe('measurementSummary', () => {
  it('rolls pieces up into areas and areas up into the total, at 20% fabrication', () => {
    const summary = measurementSummary(
      [area('a1', 'Area 1', [piece('p1', 'A-1'), piece('p2', 'A-2')])],
      20,
    );

    expect(summary.label).toBe('Total Project');
    expect(summary.countertopSqFt).toBeCloseTo(2 * (1_200_000 / 92903.04));
    expect(summary.fabricationSqFt).toBeCloseTo(summary.countertopSqFt * 1.2);

    expect(summary.areas).toHaveLength(1);
    expect(summary.areas[0].label).toBe('Area 1');
    expect(summary.areas[0].countertopSqFt).toBeCloseTo(summary.countertopSqFt);

    expect(summary.areas[0].pieces).toHaveLength(2);
    expect(summary.areas[0].pieces[0].label).toBe('A-1');
    expect(summary.areas[0].pieces[0].fabricationSqFt).toBeCloseTo(summary.areas[0].pieces[0].countertopSqFt * 1.2);
  });

  it('is zero throughout for an area with no pieces', () => {
    const summary = measurementSummary([area('a1', 'Area 1', [])], 20);
    expect(summary.countertopSqFt).toBe(0);
    expect(summary.fabricationSqFt).toBe(0);
    expect(summary.areas[0].pieces).toEqual([]);
  });

  it('adds no markup at 0%', () => {
    const summary = measurementSummary([area('a1', 'Area 1', [piece('p1', 'A-1')])], 0);
    expect(summary.fabricationSqFt).toBeCloseTo(summary.countertopSqFt);
  });

  it('sums multiple areas into the total', () => {
    const summary = measurementSummary(
      [area('a1', 'Area 1', [piece('p1', 'A-1')]), area('a2', 'Area 2', [piece('p2', 'A-2')])],
      20,
    );
    expect(summary.areas).toHaveLength(2);
    expect(summary.countertopSqFt).toBeCloseTo(summary.areas[0].countertopSqFt + summary.areas[1].countertopSqFt);
  });
});
