// Builds the Total Project -> Area -> Piece sq ft hierarchy shown by the sq
// ft icon's hover breakdown (components/drawing/AreaSummary.tsx). Countertop
// is the piece's own gross outline area (the same figure the status bar's
// headline sq ft already shows); Fabrication adds the Company Preferences
// tab's markup on top (fabricationSqFt). No Profile figure yet — the app has
// nothing to compute one from.

import type { DrawingArea } from '@/types/drawing';
import { fabricationSqFt, mm2ToSqFt, pieceMetrics } from './metrics';

export interface MeasurementRow {
  id: string;
  label: string;
  countertopSqFt: number;
  fabricationSqFt: number;
}

export interface MeasurementSummary extends MeasurementRow {
  areas: (MeasurementRow & { pieces: MeasurementRow[] })[];
}

export function measurementSummary(areas: DrawingArea[], fabricationPercent: number): MeasurementSummary {
  const areaRows = areas.map((area) => {
    const pieceRows = area.pieces.map((piece) => {
      const countertopSqFt = mm2ToSqFt(pieceMetrics(piece).grossAreaMm2);
      return { id: piece.id, label: piece.label, countertopSqFt, fabricationSqFt: fabricationSqFt(countertopSqFt, fabricationPercent) };
    });
    const countertopSqFt = pieceRows.reduce((sum, p) => sum + p.countertopSqFt, 0);
    return {
      id: area.id,
      label: area.name,
      countertopSqFt,
      fabricationSqFt: fabricationSqFt(countertopSqFt, fabricationPercent),
      pieces: pieceRows,
    };
  });
  const countertopSqFt = areaRows.reduce((sum, a) => sum + a.countertopSqFt, 0);
  return {
    id: 'total',
    label: 'Total Project',
    countertopSqFt,
    fabricationSqFt: fabricationSqFt(countertopSqFt, fabricationPercent),
    areas: areaRows,
  };
}
