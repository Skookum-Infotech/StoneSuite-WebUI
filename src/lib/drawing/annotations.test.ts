import { describe, expect, it } from 'vitest';
import { layoutDimension, layoutEdgeDimensions } from './dimensions';
import {
  areaVertices, dimensionProblem, newDimension, newNote, noteProblem, snapToVertex, MAX_NOTE_LENGTH,
} from './annotations';
import { rectOutline } from './geometry';

describe('layoutDimension', () => {
  it('measures the real distance and offsets to the left of travel', () => {
    const d = layoutDimension({ x: 0, y: 0 }, { x: 300, y: 400 }, 10);
    expect(d.lengthMm).toBe(500);
    expect(d.lineFrom.x).toBeCloseTo(-8);
    expect(d.lineFrom.y).toBeCloseTo(6);
  });
  it('matches the per-edge layout for the same edge', () => {
    const outline = rectOutline(1000, 500);
    const [first] = layoutEdgeDimensions(outline, 50);
    expect(layoutDimension(first.edgeFrom, first.edgeTo, 50)).toEqual(first);
  });
});

describe('notes and dimensions', () => {
  it('rejects empty and over-long notes', () => {
    expect(noteProblem('  ')).not.toBeNull();
    expect(noteProblem('a'.repeat(MAX_NOTE_LENGTH + 1))).not.toBeNull();
    expect(noteProblem('Seam here')).toBeNull();
  });
  it('rejects a dimension between identical points or with a huge offset', () => {
    expect(dimensionProblem({ x: 1, y: 1 }, { x: 1, y: 1 }, 10)).not.toBeNull();
    expect(dimensionProblem({ x: 0, y: 0 }, { x: 1, y: 0 }, 1e9)).not.toBeNull();
    expect(dimensionProblem({ x: 0, y: 0 }, { x: 1, y: 0 }, 40)).toBeNull();
  });
  it('builds a note and a dimension with defaults', () => {
    expect(newNote({ x: 1, y: 2 }, 'n').at).toEqual({ x: 1, y: 2 });
    expect(newDimension({ x: 0, y: 0 }, { x: 5, y: 0 }, 'd').offsetMm).toBeGreaterThan(0);
  });
});

describe('snapToVertex', () => {
  const vertices = areaVertices({
    pieces: [{
      id: 'p', label: 'A-1', shape: 'rect', outline: rectOutline(1000, 500), position: { x: 100, y: 0 },
      rotationDeg: 0, thicknessMm: 30, edges: [], seams: [], cutouts: [],
    }],
  });
  it('lands on a corner within tolerance and otherwise leaves the point alone', () => {
    const corner = vertices[0];
    expect(snapToVertex({ x: corner.x + 3, y: corner.y - 2 }, vertices, 12)).toEqual(corner);
    expect(snapToVertex({ x: corner.x + 50, y: corner.y }, vertices, 12)).toEqual({ x: corner.x + 50, y: corner.y });
  });
  it('picks the nearest of two candidates', () => {
    expect(snapToVertex({ x: 4, y: 0 }, [{ x: 0, y: 0 }, { x: 6, y: 0 }], 12)).toEqual({ x: 6, y: 0 });
  });
});
