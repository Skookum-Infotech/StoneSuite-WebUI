// Attached-profile panels (Profiles tool: Backsplash, Lamination, Waterfall,
// etc.): the vertical or flat pieces a painted side's AttachedProfileType
// asks for in 3D. Each is a thin wall standing along that side, described as
// a footprint (in world millimetres) plus where it starts and how tall it is.
// How it sits is the type's angle:
//  - 90 (upright, e.g. Backsplash): stands on the counter's top face, set in
//    from the side by SPLASH_THICKNESS_MM, as tall as the chosen measurement.
//  - 270 (dropped, e.g. Waterfall): flush with the side, running down from
//    the top face by the chosen measurement, as thick as the slab itself.
//  - 180 (flat, e.g. Lamination): a second, slab-thick band right under the
//    edge, extending out by the chosen measurement — the build-up strip that
//    makes a thin edge look thicker.

import type { AttachedProfileType, Piece, Point } from '@/types/drawing';
import { arcHeightOf, arcPoints } from '../arcs';
import { paintedProfileSides } from '../attachedProfileTypes';
import { isClockwise, outlineEdges, transformOutline } from '../geometry';
import type { SlabPlaceable } from '../slabPlaceables';
import { COUNTER_HEIGHT_MM, SPLASH_THICKNESS_MM } from './constants';
import { resolvePanelTexture, type PanelTexture } from './panelTexture';
import type { SlabPhoto } from './slabTexture';

export type PanelKind = 'upright' | 'dropped' | 'flat';

export interface PanelSolid {
  id: string;
  kind: PanelKind;
  /** World outline of the wall as seen from above. */
  footprint: Point[];
  baseMm: number;
  heightMm: number;
  /** The slab photo this panel's own allocation shows, when it has one — only
   *  for 'upright'/'dropped' (a genuine standing face to unfold a photo onto);
   *  a 'flat' build-up strip's visible face is its own raw stone edge, not a
   *  photographed surface, so it never gets one. */
  texture: PanelTexture | null;
}

/** One wall along a -> b, `thicknessMm` towards the inside of the piece (`inward` is the
 *  unit-length sign: +1 turns right of travel, the inside of a clockwise outline). */
function wall(a: Point, b: Point, thicknessMm: number, inward: 1 | -1): Point[] {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length === 0) return [];
  const n = { x: ((b.y - a.y) / length) * inward * thicknessMm, y: (-(b.x - a.x) / length) * inward * thicknessMm };
  return [a, b, { x: b.x + n.x, y: b.y + n.y }, { x: a.x + n.x, y: a.y + n.y }];
}

function panelSpec(angle: AttachedProfileType['angle'], measurementMm: number, thicknessMm: number):
  { kind: PanelKind; height: number; thick: number; base: number } {
  if (angle === 90) return { kind: 'upright', height: measurementMm, thick: SPLASH_THICKNESS_MM, base: COUNTER_HEIGHT_MM };
  if (angle === 270) return { kind: 'dropped', height: measurementMm, thick: thicknessMm, base: COUNTER_HEIGHT_MM - measurementMm };
  return { kind: 'flat', height: thicknessMm, thick: measurementMm, base: COUNTER_HEIGHT_MM - thicknessMm };
}

export function buildPanels(
  piece: Piece,
  thicknessMm: number,
  profileTypes: AttachedProfileType[] = [],
  placeables: SlabPlaceable[] = [],
  photos: Record<string, SlabPhoto> = {},
): PanelSolid[] {
  const inward = isClockwise(piece.outline) ? 1 : -1;
  const panels: PanelSolid[] = [];
  const painted = new Map(paintedProfileSides(piece.edges, profileTypes).map((p) => [p.index, p]));
  outlineEdges(piece.outline).forEach(([from, to], index) => {
    const side = painted.get(index);
    if (!side) return;
    const { kind, height, thick, base } = panelSpec(side.type.angle, side.measurementMm, thicknessMm);
    const placement = piece.edges.find((e) => e.index === index)?.attachedProfile?.slab;
    const texture = kind === 'flat' ? null : resolvePanelTexture(
      piece, index, side.measurementMm, placement, photos, placeables, kind === 'dropped',
    );
    const path = [from, ...arcPoints(from, to, arcHeightOf(piece.edges, index)), to];
    path.slice(0, -1).forEach((a, k) => {
      const footprint = wall(a, path[k + 1], thick, inward);
      if (footprint.length === 0) return;
      panels.push({
        id: `${piece.id}:${index}:${kind}:${k}`,
        kind,
        footprint: transformOutline(footprint, piece.position, piece.rotationDeg),
        baseMm: base,
        heightMm: height,
        texture,
      });
    });
  });
  return panels;
}
