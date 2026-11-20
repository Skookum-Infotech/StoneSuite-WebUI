// Draws a drawing scene (lib/drawingPdfModel.ts) into a rectangle of a PDF page
// as vector lines, to scale — so a piece prints sharp at any zoom and its
// outline is the real outline, not a screenshot of it. World space is y-up and
// slab space is y-down; `flipY` picks which way the scene's y runs on paper.

import type { Point } from '@/types/drawing';
import { BRAND_LIME, INK, STONE_200, STONE_400, STONE_600, type DocWithAutoTable } from '@/lib/pdfBranding';
import { CARD_FILL } from '@/lib/pdfDocumentBlocks';
import { hexToRgb, type AreaScene, type Bounds, type SlabLayout } from '@/lib/drawingPdfModel';

export interface Box { x: number; y: number; w: number; h: number }

/** Room kept inside the box for the side figures that sit outside the stone. */
const PADDING_PT = 26;
/** Sides shorter than this on paper get no figure — it would not fit beside them. */
const MIN_SIDE_LABEL_PT = 26;
const SIDE_LABEL_OFFSET_PT = 9;
const SIDE_FONT_PT = 7;
const PIECE_FONT_PT = 10;
const NOTE_FONT_PT = 8;
const OUTLINE_WIDTH_PT = 1.1;
const PAINTED_WIDTH_PT = 2.6;
const HAIRLINE_PT = 0.6;
const FRAME_RADIUS_PT = 4;
const SEAM_DASH_PT = [4, 3];
const PROFILE_FILL: [number, number, number] = [236, 250, 220];
const WHITE: [number, number, number] = [255, 255, 255];

interface Projection {
  toPaper: (p: Point) => Point;
  scale: number;
}

function project(world: Bounds, box: Box, flipY: boolean): Projection {
  const width = Math.max(world.maxX - world.minX, 1);
  const height = Math.max(world.maxY - world.minY, 1);
  const availW = Math.max(box.w - PADDING_PT * 2, 1);
  const availH = Math.max(box.h - PADDING_PT * 2, 1);
  const scale = Math.min(availW / width, availH / height);
  // Centre whatever room is left over, so a long thin top sits mid-box.
  const originX = box.x + (box.w - width * scale) / 2;
  const originY = box.y + (box.h - height * scale) / 2;
  return {
    scale,
    toPaper: (p) => ({
      x: originX + (p.x - world.minX) * scale,
      y: originY + (flipY ? (world.maxY - p.y) : (p.y - world.minY)) * scale,
    }),
  };
}

function polygon(doc: DocWithAutoTable, points: Point[], style: 'S' | 'FD'): void {
  if (points.length < 2) return;
  const [first, ...rest] = points;
  const segments = rest.map((p, i) => {
    const prev = i === 0 ? first : rest[i - 1];
    return [p.x - prev.x, p.y - prev.y];
  });
  doc.lines(segments, first.x, first.y, [1, 1], style, true);
}

function centredText(doc: DocWithAutoTable, text: string, at: Point, size: number, bold = false): void {
  doc.setFont('helvetica', bold ? 'bold' : 'normal');
  doc.setFontSize(size);
  doc.text(text, at.x, at.y, { align: 'center', baseline: 'middle' });
}

/** The border every sketch sits in. */
function frame(doc: DocWithAutoTable, box: Box): void {
  doc.setDrawColor(...STONE_200);
  doc.setLineWidth(HAIRLINE_PT);
  doc.roundedRect(box.x, box.y, box.w, box.h, FRAME_RADIUS_PT, FRAME_RADIUS_PT, 'S');
}

/** One area's pieces to scale inside `box`: outlines, cutouts, seams (dashed), each side's
 *  letter and length with painted sides in their edge colour, profiles, dimensions and notes. */
export function drawAreaScene(doc: DocWithAutoTable, scene: AreaScene, box: Box): void {
  frame(doc, box);
  if (!scene.bounds) return;
  const { toPaper, scale } = project(scene.bounds, box, true);
  const paper = (points: Point[]) => points.map(toPaper);

  doc.setLineWidth(HAIRLINE_PT);
  doc.setDrawColor(...STONE_400);
  for (const profile of scene.profiles) {
    doc.setFillColor(...PROFILE_FILL);
    polygon(doc, paper(profile.outline), 'FD');
    const mid = toPaper({
      x: profile.outline.reduce((s, p) => s + p.x, 0) / profile.outline.length,
      y: profile.outline.reduce((s, p) => s + p.y, 0) / profile.outline.length,
    });
    doc.setTextColor(...STONE_600);
    centredText(doc, profile.label, mid, SIDE_FONT_PT);
  }

  doc.setDrawColor(...INK);
  doc.setLineWidth(OUTLINE_WIDTH_PT);
  doc.setFillColor(...CARD_FILL);
  for (const shape of scene.shapes) polygon(doc, paper(shape.outline), 'FD');

  doc.setLineWidth(HAIRLINE_PT);
  doc.setDrawColor(...STONE_600);
  doc.setFillColor(...WHITE);
  for (const cutout of scene.cutouts) polygon(doc, paper(cutout), 'FD');

  doc.setDrawColor(...INK);
  doc.setLineDashPattern(SEAM_DASH_PT, 0);
  for (const [from, to] of scene.seams) {
    const a = toPaper(from);
    const b = toPaper(to);
    doc.line(a.x, a.y, b.x, b.y);
  }
  doc.setLineDashPattern([], 0);

  doc.setLineWidth(PAINTED_WIDTH_PT);
  for (const side of scene.sides) {
    if (!side.color) continue;
    const a = toPaper(side.from);
    const b = toPaper(side.to);
    doc.setDrawColor(...hexToRgb(side.color));
    doc.line(a.x, a.y, b.x, b.y);
  }

  doc.setTextColor(...INK);
  for (const shape of scene.shapes) centredText(doc, shape.label, toPaper(shape.labelAt), PIECE_FONT_PT, true);

  doc.setTextColor(...STONE_600);
  for (const side of scene.sides) {
    const a = toPaper(side.from);
    const b = toPaper(side.to);
    if (Math.hypot(b.x - a.x, b.y - a.y) < MIN_SIDE_LABEL_PT) continue;
    // `outward` is world y-up; paper y runs down. A side with a profile piece beside
    // it takes its figure beyond that piece rather than underneath it.
    const reach = SIDE_LABEL_OFFSET_PT + side.clearanceMm * scale;
    const at = {
      x: (a.x + b.x) / 2 + side.outward.x * reach,
      y: (a.y + b.y) / 2 - side.outward.y * reach,
    };
    centredText(doc, `${side.letter}: ${side.text}`, at, SIDE_FONT_PT);
  }

  doc.setDrawColor(...INK);
  doc.setLineWidth(HAIRLINE_PT);
  for (const dim of scene.dimensions) {
    const a = toPaper(dim.from);
    const b = toPaper(dim.to);
    doc.line(a.x, a.y, b.x, b.y);
    doc.setTextColor(...INK);
    centredText(doc, dim.text, { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 - SIDE_LABEL_OFFSET_PT / 2 }, SIDE_FONT_PT);
  }

  doc.setTextColor(...STONE_600);
  for (const note of scene.notes) centredText(doc, note.text, toPaper(note.at), NOTE_FONT_PT);
}

/** A slab with the pieces laid on it, to scale, in slab space (y down, origin top-left). */
export function drawSlabLayout(doc: DocWithAutoTable, layout: SlabLayout, box: Box): void {
  frame(doc, box);
  const { toPaper } = project({ minX: 0, minY: 0, maxX: layout.lengthMm, maxY: layout.widthMm }, box, false);
  const slab = [
    { x: 0, y: 0 }, { x: layout.lengthMm, y: 0 }, { x: layout.lengthMm, y: layout.widthMm }, { x: 0, y: layout.widthMm },
  ].map(toPaper);

  doc.setDrawColor(...STONE_400);
  doc.setLineWidth(OUTLINE_WIDTH_PT);
  doc.setFillColor(...CARD_FILL);
  polygon(doc, slab, 'FD');

  doc.setDrawColor(...INK);
  doc.setFillColor(...BRAND_LIME);
  for (const item of layout.items) polygon(doc, item.outline.map(toPaper), 'FD');

  doc.setTextColor(...INK);
  for (const item of layout.items) {
    const mid = toPaper({
      x: item.outline.reduce((s, p) => s + p.x, 0) / item.outline.length,
      y: item.outline.reduce((s, p) => s + p.y, 0) / item.outline.length,
    });
    centredText(doc, item.label, mid, SIDE_FONT_PT + 1, true);
  }
}
