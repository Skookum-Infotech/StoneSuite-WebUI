// Measurements derived from a piece's real geometry. Everything is computed
// from the outline and cutouts — nothing is stored — so it can never drift
// from what is drawn.
//
// `netAreaMm2` is the finished surface (outline minus openings). It is NOT a
// slab-consumption figure: slab use depends on layout, kerf, waste and
// remnants, which this editor does not model.

import type { DrawingArea, Piece } from '@/types/drawing';
import { cutoutArea } from './cutouts';
import { area, distance, outlineEdges, perimeter } from './geometry';
import { interiorAngles } from './polygon';

export const MM2_PER_FT2 = 92903.04;

export interface EdgeMetric {
  index: number;
  lengthMm: number;
  /** Interior angle at the edge's starting corner, in degrees. */
  startAngleDeg: number;
}

export interface PieceMetrics {
  grossAreaMm2: number;
  cutoutAreaMm2: number;
  netAreaMm2: number;
  perimeterMm: number;
  edges: EdgeMetric[];
}

export function pieceMetrics(piece: Pick<Piece, 'outline' | 'cutouts'>): PieceMetrics {
  const grossAreaMm2 = area(piece.outline);
  const cutoutAreaMm2 = piece.cutouts.reduce((sum, c) => sum + cutoutArea(c), 0);
  const angles = interiorAngles(piece.outline);
  return {
    grossAreaMm2,
    cutoutAreaMm2,
    netAreaMm2: Math.max(0, grossAreaMm2 - cutoutAreaMm2),
    perimeterMm: perimeter(piece.outline),
    edges: outlineEdges(piece.outline).map(([a, b], index) => ({
      index, lengthMm: distance(a, b), startAngleDeg: angles[index],
    })),
  };
}

export interface AreaMetrics {
  pieceCount: number;
  cutoutCount: number;
  grossAreaMm2: number;
  cutoutAreaMm2: number;
  netAreaMm2: number;
}

export function areaMetrics(pieces: Piece[]): AreaMetrics {
  return pieces.reduce<AreaMetrics>((sum, piece) => {
    const m = pieceMetrics(piece);
    return {
      pieceCount: sum.pieceCount + 1,
      cutoutCount: sum.cutoutCount + piece.cutouts.length,
      grossAreaMm2: sum.grossAreaMm2 + m.grossAreaMm2,
      cutoutAreaMm2: sum.cutoutAreaMm2 + m.cutoutAreaMm2,
      netAreaMm2: sum.netAreaMm2 + m.netAreaMm2,
    };
  }, { pieceCount: 0, cutoutCount: 0, grossAreaMm2: 0, cutoutAreaMm2: 0, netAreaMm2: 0 });
}

export function drawingMetrics(areas: DrawingArea[]): AreaMetrics {
  return areaMetrics(areas.flatMap((a) => a.pieces));
}

export function mm2ToSqFt(mm2: number): number {
  return mm2 / MM2_PER_FT2;
}
