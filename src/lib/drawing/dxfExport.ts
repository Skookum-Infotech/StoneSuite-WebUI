// Maps a DrawingArea onto the generic DxfWriter: one DXF file per area,
// named per build spec §6 ("one per area: SO_<orderNumber>_<AreaName>_P
// <areaIndex>_<seq>.dxf"). Pure — no file-system or network access, so the
// save/export flow and its tests can call this the same way.

import type { DrawingArea, Point } from '@/types/drawing';
import { outlineEdges } from './geometry';
import { MM_PER_INCH } from './constants';
import { DxfWriter } from './dxfWriter';

export interface DxfExportMeta {
  orderNumber: string;
  areaIndex: number;
  seq: number;
  fractionDenominator: 16 | 32;
}

/** File name for one area's export, per build spec §6's naming rule. Any
 *  character that isn't alphanumeric in the area name collapses to a
 *  single underscore, so "Kitchen " or "Master Bath" both produce a safe
 *  filename. */
export function dxfFileName(orderNumber: string, areaName: string, meta: Pick<DxfExportMeta, 'areaIndex' | 'seq'>): string {
  const safeAreaName = areaName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Area';
  return `SO_${orderNumber}_${safeAreaName}_P${meta.areaIndex}_${meta.seq}.dxf`;
}

/** Builds one area's DXF: every piece's outline (as a closed POLYLINE),
 *  its label, and one aligned dimension per outer edge. Seams, splashes,
 *  cut-outs, edge codes, and notes are build spec Task 4 — not part of
 *  this proof. */
export function buildAreaDxf(area: DrawingArea, meta: DxfExportMeta): string {
  const writer = new DxfWriter();

  for (const piece of area.pieces) {
    const outlineIn = piece.outline.map(mmPointToInches);
    writer.addOutline(outlineIn);
    writer.addLabel(piece.label, centroid(outlineIn));

    for (const [fromMm, toMm] of outlineEdges(piece.outline)) {
      const measurementMm = Math.hypot(toMm.x - fromMm.x, toMm.y - fromMm.y);
      writer.addAlignedDimension(mmPointToInches(fromMm), mmPointToInches(toMm), measurementMm, meta.fractionDenominator);
    }
  }

  return writer.build();
}

function mmPointToInches(p: Point): Point {
  return { x: p.x / MM_PER_INCH, y: p.y / MM_PER_INCH };
}

function centroid(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}
