// What the drawing PDF shows, worked out without any PDF code: the geometry of
// one area (pieces, cutouts, seams, side letters and lengths, profiles, manual
// dimensions) in world millimetres, the rows of its pieces table and its edge
// legend, and the slab layouts. Pure, so every figure can be tested directly;
// lib/drawingPdfSketch.ts draws the scene and lib/drawingPdfExport.ts lays the
// pages out.

import type { AttachedProfileType, DrawingArea, Drawing, EdgeType, Piece, Point } from '@/types/drawing';
import type { DrawingSlabUnit } from '@/types/drawingSlab';
import { arcLength, outlinePolyline } from './drawing/arcs';
import { attachedProfilePieces } from './drawing/attachedProfileGeometry';
import { ATTACHED_PROFILE_GAP_MM } from './drawing/constants';
import { CUTOUT_TYPE_LABELS, cutoutOutline } from './drawing/cutouts';
import { bounds, centroid, distance, outlineEdges, transformOutline } from './drawing/geometry';
import { edgeLetter } from './drawing/labels';
import { areaMetrics, mm2ToSqFt, pieceMetrics } from './drawing/metrics';
import { paintedSides } from './drawing/edgeTypes';
import { placedOutline } from './drawing/slabs';
import { slabPlaceables } from './drawing/slabPlaceables';
import { formatLength } from './drawing/units';

const SQ_FT_DECIMALS = 2;
const RGB_CHANNELS = 3;
const SHORT_HEX_LENGTH = 3;
const HEX_RADIX = 16;
const FALLBACK_COLOR: [number, number, number] = [28, 25, 23];

export type Rgb = [number, number, number];

/** "#2563eb" or "#26e" as jsPDF's 0-255 channels; the ink colour for anything unreadable. */
export function hexToRgb(hex: string): Rgb {
  const digits = hex.trim().replace(/^#/, '');
  const full = digits.length === SHORT_HEX_LENGTH ? digits.split('').map((c) => c + c).join('') : digits;
  if (!/^[0-9a-f]{6}$/i.test(full)) return FALLBACK_COLOR;
  return Array.from({ length: RGB_CHANNELS }, (_, i) => parseInt(full.slice(i * 2, i * 2 + 2), HEX_RADIX)) as Rgb;
}

export interface Bounds { minX: number; minY: number; maxX: number; maxY: number }

export interface SceneSide {
  from: Point;
  to: Point;
  letter: string;
  /** The straight-line length, as the drawing shows it ("25 1/2\""). */
  text: string;
  /** Unit vector pointing away from the stone, so the figure sits outside it. */
  outward: Point;
  /** How far past the side, in mm, something else is drawn (an attached profile
   *  piece), so the figure can be set beyond it instead of underneath it. */
  clearanceMm: number;
  /** The painted edge type's colour; absent on a side nobody painted. */
  color?: string;
}

export interface AreaScene {
  shapes: Array<{ outline: Point[]; label: string; labelAt: Point }>;
  cutouts: Point[][];
  seams: Array<[Point, Point]>;
  sides: SceneSide[];
  profiles: Array<{ outline: Point[]; label: string }>;
  dimensions: Array<{ from: Point; to: Point; text: string }>;
  notes: Array<{ at: Point; text: string }>;
  /** World bounds of everything drawn; null for an area with nothing in it. */
  bounds: Bounds | null;
}

/** Side `i` of a clockwise (y-up) outline has the stone on its right, so
 *  outward is its left normal. */
function outwardOf(from: Point, to: Point): Point {
  const length = distance(from, to) || 1;
  return { x: -(to.y - from.y) / length, y: (to.x - from.x) / length };
}

function pieceSides(piece: Piece, drawing: Drawing, edgeTypes: EdgeType[], profileTypes: AttachedProfileType[]): SceneSide[] {
  // A round top is one smooth curve: its 48 flattened sides would be noise.
  if (piece.shape === 'circle') return [];
  const colors = new Map(paintedSides(piece.edges, edgeTypes).map((s) => [s.index, s.color]));
  return outlineEdges(transformOutline(piece.outline, piece.position, piece.rotationDeg)).map(([from, to], index) => {
    const attached = piece.edges.find((e) => e.index === index)?.attachedProfile;
    // Only a profile whose type resolves is drawn (attachedProfilePieces), so only it needs room.
    const drawn = attached !== undefined && profileTypes.some((t) => t.id === attached.profileTypeId);
    return {
      from,
      to,
      letter: edgeLetter(index),
      text: formatLength(distance(from, to), drawing.displayUnit, drawing.fractionDenominator),
      outward: outwardOf(from, to),
      clearanceMm: drawn ? ATTACHED_PROFILE_GAP_MM + attached.measurementMm : 0,
      color: colors.get(index),
    };
  });
}

export function buildAreaScene(area: DrawingArea, drawing: Drawing, edgeTypes: EdgeType[], profileTypes: AttachedProfileType[]): AreaScene {
  const { displayUnit, fractionDenominator } = drawing;
  const shapes = area.pieces.map((piece) => {
    const outline = transformOutline(outlinePolyline(piece.outline, piece.edges), piece.position, piece.rotationDeg);
    return { outline, label: piece.label, labelAt: centroid(outline) };
  });
  const profiles = area.pieces.flatMap((piece) => attachedProfilePieces(piece, profileTypes)
    .map(({ outline, label }) => ({ outline, label })));
  const dimensions = (area.dimensions ?? [])
    .filter((d) => distance(d.from, d.to) > 0)
    .map((d) => ({ from: d.from, to: d.to, text: formatLength(distance(d.from, d.to), displayUnit, fractionDenominator) }));
  const notes = area.notes.map((n) => ({ at: n.at, text: n.text }));

  const cloud = [
    ...shapes.flatMap((s) => s.outline),
    ...profiles.flatMap((p) => p.outline),
    ...dimensions.flatMap((d) => [d.from, d.to]),
    ...notes.map((n) => n.at),
  ];
  return {
    shapes,
    cutouts: area.pieces.flatMap((piece) => piece.cutouts
      .map((c) => transformOutline(cutoutOutline(c), piece.position, piece.rotationDeg))
      .filter((outline) => outline.length >= 3)),
    seams: area.pieces.flatMap((piece) => piece.seams.map((s): [Point, Point] => {
      const [from, to] = transformOutline([s.from, s.to], piece.position, piece.rotationDeg);
      return [from, to];
    })),
    sides: area.pieces.flatMap((piece) => pieceSides(piece, drawing, edgeTypes, profileTypes)),
    profiles,
    dimensions,
    notes,
    bounds: cloud.length > 0 ? bounds(cloud) : null,
  };
}

/** What a side is finished with: its edge type (or the old free-text code) and
 *  any profile attached to it. */
function sideFinish(piece: Piece, index: number, drawing: Drawing, edgeTypes: EdgeType[], profileTypes: AttachedProfileType[]): string {
  const edge = piece.edges.find((e) => e.index === index);
  if (!edge) return '';
  const type = edgeTypes.find((t) => t.id === edge.edgeTypeId);
  const attached = edge.attachedProfile;
  const profile = attached && profileTypes.find((t) => t.id === attached.profileTypeId);
  const parts = [
    type ? (type.alias || type.name) : edge.code,
    profile && attached
      ? `${profile.alias || profile.name} ${formatLength(attached.measurementMm, drawing.displayUnit, drawing.fractionDenominator)}`
      : undefined,
  ].filter(Boolean);
  return parts.length > 0 ? `${edgeLetter(index)} ${parts.join(' + ')}` : '';
}

function cutoutSummary(piece: Piece): string {
  const counts = new Map<string, number>();
  for (const c of piece.cutouts) {
    const name = CUTOUT_TYPE_LABELS[c.type] ?? 'Cutout';
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts].map(([name, n]) => (n > 1 ? `${name} ×${n}` : name)).join(', ');
}

export const PIECE_TABLE_HEAD = ['Piece', 'Size', 'Sq Ft', 'Edges & profiles', 'Cutouts'];

/** One row per piece: label, its own length × width, sq ft, what each side is finished with, its cutouts. */
export function pieceTableRows(area: DrawingArea, drawing: Drawing, edgeTypes: EdgeType[], profileTypes: AttachedProfileType[]): string[][] {
  return area.pieces.map((piece) => {
    const b = bounds(piece.outline);
    const size = [b.maxX - b.minX, b.maxY - b.minY]
      .map((mm) => formatLength(mm, drawing.displayUnit, drawing.fractionDenominator)).join(' × ');
    const sqFt = mm2ToSqFt(pieceMetrics(piece).grossAreaMm2).toFixed(SQ_FT_DECIMALS);
    const finishes = piece.outline
      .map((_, i) => sideFinish(piece, i, drawing, edgeTypes, profileTypes))
      .filter(Boolean)
      .join(', ');
    return [piece.label, size, sqFt, finishes || '—', cutoutSummary(piece) || '—'];
  });
}

export interface LegendEntry {
  name: string;
  alias: string;
  color: string;
  lengthMm: number;
}

/** The edge types painted anywhere in the area, with how much of each there is
 *  (along the curve for a curved side), in the shop's own order of types. */
export function edgeLegend(area: DrawingArea, edgeTypes: EdgeType[]): LegendEntry[] {
  const totals = new Map<string, number>();
  for (const piece of area.pieces) {
    const sides = outlineEdges(piece.outline);
    for (const edge of piece.edges) {
      const side = sides[edge.index];
      if (!side || edge.edgeTypeId === undefined) continue;
      const length = arcLength(distance(side[0], side[1]), edge.arcHeightMm ?? 0);
      totals.set(edge.edgeTypeId, (totals.get(edge.edgeTypeId) ?? 0) + length);
    }
  }
  return edgeTypes
    .filter((t) => totals.has(t.id))
    .map((t) => ({ name: t.name, alias: t.alias, color: t.color, lengthMm: totals.get(t.id) ?? 0 }));
}

export interface AreaTotals {
  pieces: number;
  sqFt: number;
}

export function areaTotals(area: DrawingArea): AreaTotals {
  const m = areaMetrics(area.pieces);
  return { pieces: m.pieceCount, sqFt: mm2ToSqFt(m.grossAreaMm2) };
}

export interface SlabLayout {
  title: string;
  /** "126" × 63"" — the slab's own size. */
  size: string;
  lengthMm: number;
  widthMm: number;
  /** In slab space: y down, origin at the slab's top-left. */
  items: Array<{ outline: Point[]; label: string }>;
}

/** One layout per slab that something is laid on, in the order slabs are given. A
 *  placement on a slab that is not in `slabs` (released since) is left out. */
export function slabLayouts(drawing: Drawing, profileTypes: AttachedProfileType[], slabs: DrawingSlabUnit[]): SlabLayout[] {
  const placed = slabPlaceables(drawing.areas, profileTypes).filter((p) => p.slab !== undefined);
  return slabs.flatMap((slab) => {
    const onSlab = placed.filter((p) => p.slab?.slabId === slab.id);
    if (onSlab.length === 0) return [];
    const fmt = (mm: number) => formatLength(mm, drawing.displayUnit, drawing.fractionDenominator);
    return [{
      title: [slab.inventoryItemName, slab.serial].filter(Boolean).join(' ') || 'Slab',
      size: `${fmt(slab.lengthMm)} × ${fmt(slab.widthMm)}`,
      lengthMm: slab.lengthMm,
      widthMm: slab.widthMm,
      items: onSlab.flatMap((p) => (p.slab ? [{ outline: placedOutline(p, p.slab), label: p.label }] : [])),
    }];
  });
}
