// Maps a DrawingArea onto the generic DxfWriter: one DXF file per area,
// named per build spec §6 ("one per area: SO_<orderNumber>_<AreaName>_P
// <areaIndex>_<seq>.dxf"). Pure — no file-system or network access, so the
// save/export flow and its tests can call this the same way.

import type { AttachedProfileType, DrawingArea, Piece, PieceEdge, Point } from '@/types/drawing';
import { outlinePolyline } from './arcs';
import { cutoutOutline } from './cutouts';
import { outlineEdges, transformOutline } from './geometry';
import { DXF_LAYER, MM_PER_INCH } from './constants';
import { formatLength } from './units';
import { DxfWriter } from './dxfWriter';

export interface DxfExportMeta {
  orderNumber: string;
  areaIndex: number;
  seq: number;
  fractionDenominator: 16 | 32;
  /** Unit the edge notes are written in; defaults to inches. */
  displayUnit?: 'in' | 'mm';
}

/** File name for one area's export, per build spec §6's naming rule. Any
 *  character that isn't alphanumeric in the area name collapses to a
 *  single underscore, so "Kitchen " or "Master Bath" both produce a safe
 *  filename. */
export function dxfFileName(orderNumber: string, areaName: string, meta: Pick<DxfExportMeta, 'areaIndex' | 'seq'>): string {
  const safeAreaName = areaName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'Area';
  return `SO_${orderNumber}_${safeAreaName}_P${meta.areaIndex}_${meta.seq}.dxf`;
}

/** Builds one area's DXF: every piece's outline (a closed POLYLINE), its
 *  label, one aligned dimension per outer edge, each cutout's outline (round
 *  ones as 48-sided polylines) on the CUTOUTS layer, per-side edge notes
 *  (profile code, plus any attached profile's alias and measurement) on
 *  EDGES, and the area's notes and manual dimensions, and each seam as an
 *  open LINE. */
export function buildAreaDxf(area: DrawingArea, meta: DxfExportMeta, profileTypes: AttachedProfileType[] = []): string {
  const writer = new DxfWriter();
  const profileTypesById = new Map(profileTypes.map((t) => [t.id, t]));

  for (const piece of area.pieces) {
    // World coordinates: the piece's own outline never carries its position
    // or rotation, so without this every piece would export stacked at the
    // origin instead of where it sits in the drawing.
    const worldMm = transformOutline(piece.outline, piece.position, piece.rotationDeg);
    // A curved side is written as the short straight pieces that approximate
    // it; the dimensions below still measure the straight line across it.
    const outlineIn = toWorldInches(outlinePolyline(piece.outline, piece.edges), piece);
    writer.addOutline(outlineIn);
    writer.addLabel(piece.label, centroid(outlineIn));

    for (const [fromMm, toMm] of outlineEdges(worldMm)) {
      const measurementMm = Math.hypot(toMm.x - fromMm.x, toMm.y - fromMm.y);
      writer.addAlignedDimension(mmPointToInches(fromMm), mmPointToInches(toMm), measurementMm, meta.fractionDenominator);
    }

    for (const cutout of piece.cutouts) {
      const opening = cutoutOutline(cutout);
      if (opening.length >= 3) writer.addOutline(toWorldInches(opening, piece), DXF_LAYER.CUTOUTS);
    }

    for (const seam of piece.seams) {
      const [from, to] = toWorldInches([seam.from, seam.to], piece);
      writer.addLine(from, to, DXF_LAYER.SEAMS);
    }

    const sides = outlineEdges(worldMm);
    for (const edge of piece.edges) {
      const side = sides[edge.index];
      const text = edgeNote(edge, meta, profileTypesById);
      if (side && text) writer.addLabel(text, mmPointToInches(midpoint(side[0], side[1])), DXF_LAYER.EDGES);
    }
  }

  for (const note of area.notes) writer.addLabel(note.text, mmPointToInches(note.at), DXF_LAYER.NOTES);
  for (const dim of area.dimensions ?? []) {
    const lengthMm = Math.hypot(dim.to.x - dim.from.x, dim.to.y - dim.from.y);
    if (lengthMm > 0) writer.addAlignedDimension(mmPointToInches(dim.from), mmPointToInches(dim.to), lengthMm, meta.fractionDenominator);
  }

  return writer.build();
}

function toWorldInches(local: Point[], piece: Piece): Point[] {
  return transformOutline(local, piece.position, piece.rotationDeg).map(mmPointToInches);
}

function midpoint(a: Point, b: Point): Point {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

/** "BN BS 4" — the profile code, then the attached profile's alias (or name)
 *  and its chosen measurement. */
function edgeNote(edge: PieceEdge, meta: DxfExportMeta, profileTypesById: Map<string, AttachedProfileType>): string {
  const unit = meta.displayUnit ?? 'in';
  const fmt = (mm: number) => formatLength(mm, unit, meta.fractionDenominator);
  const attached = edge.attachedProfile;
  const type = attached && profileTypesById.get(attached.profileTypeId);
  return [
    edge.code,
    type && attached ? `${type.alias || type.name} ${fmt(attached.measurementMm)}` : undefined,
  ].filter(Boolean).join(' ');
}

function mmPointToInches(p: Point): Point {
  return { x: p.x / MM_PER_INCH, y: p.y / MM_PER_INCH };
}

function centroid(points: Point[]): Point {
  const sum = points.reduce((acc, p) => ({ x: acc.x + p.x, y: acc.y + p.y }), { x: 0, y: 0 });
  return { x: sum.x / points.length, y: sum.y / points.length };
}
