// Free-standing annotations on an area: text notes and manual dimensions.
// They live in the area's world millimetres, so they never depend on how the
// canvas is zoomed or panned.

import type { Dimension, DrawingArea, Note, Point } from '@/types/drawing';
import { DEFAULT_DIMENSION_OFFSET_MM, MAX_DIMENSION_MM } from './constants';
import { distance, transformOutline } from './geometry';

export const MAX_NOTE_LENGTH = 500;
export const DEFAULT_NOTE_TEXT = 'Note';

export function newNote(at: Point, id: string): Note {
  return { id, text: DEFAULT_NOTE_TEXT, at };
}

export function newDimension(from: Point, to: Point, id: string): Dimension {
  return { id, from, to, offsetMm: DEFAULT_DIMENSION_OFFSET_MM };
}

export function noteProblem(text: string): string | null {
  if (!text.trim()) return 'A note needs some text.';
  if (text.length > MAX_NOTE_LENGTH) return `A note can be at most ${MAX_NOTE_LENGTH} characters.`;
  return null;
}

export function dimensionProblem(from: Point, to: Point, offsetMm: number): string | null {
  if (distance(from, to) === 0) return 'The two points are the same.';
  if (!Number.isFinite(offsetMm) || Math.abs(offsetMm) > MAX_DIMENSION_MM) return 'That offset is too large.';
  return null;
}

/** Every corner of every piece in the area, in world millimetres. */
export function areaVertices(area: Pick<DrawingArea, 'pieces'>): Point[] {
  return area.pieces.flatMap((p) => transformOutline(p.outline, p.position, p.rotationDeg));
}

/** `point`, or the nearest piece corner when one is within `toleranceMm`. */
export function snapToVertex(point: Point, vertices: Point[], toleranceMm: number): Point {
  let best = point;
  let bestDistance = toleranceMm;
  for (const v of vertices) {
    const d = distance(point, v);
    if (d <= bestDistance) {
      best = v;
      bestDistance = d;
    }
  }
  return best;
}
