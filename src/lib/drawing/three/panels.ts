// Backsplashes and waterfall panels: the vertical pieces the Edges tool's "Backsplash height"
// and "Waterfall height" ask for on a side. Each is a thin wall standing along that side,
// described as a footprint (in world millimetres) plus where it starts and how tall it is.
//
// A backsplash stands on the counter's top face, set in from the side by SPLASH_THICKNESS_MM.
// A waterfall is flush with the side and runs down from the counter's top face by its height,
// as thick as the slab itself. (Reading "Waterfall height" as the drop from the top face.)

import type { Piece, Point } from '@/types/drawing';
import { arcHeightOf, arcPoints } from '../arcs';
import { edgeAt } from '../edges';
import { isClockwise, outlineEdges, transformOutline } from '../geometry';
import { COUNTER_HEIGHT_MM, SPLASH_THICKNESS_MM } from './constants';

export type PanelKind = 'splash' | 'waterfall';

export interface PanelSolid {
  id: string;
  kind: PanelKind;
  /** World outline of the wall as seen from above. */
  footprint: Point[];
  baseMm: number;
  heightMm: number;
}

/** One wall along a -> b, `thicknessMm` towards the inside of the piece (`inward` is the
 *  unit-length sign: +1 turns right of travel, the inside of a clockwise outline). */
function wall(a: Point, b: Point, thicknessMm: number, inward: 1 | -1): Point[] {
  const length = Math.hypot(b.x - a.x, b.y - a.y);
  if (length === 0) return [];
  const n = { x: ((b.y - a.y) / length) * inward * thicknessMm, y: (-(b.x - a.x) / length) * inward * thicknessMm };
  return [a, b, { x: b.x + n.x, y: b.y + n.y }, { x: a.x + n.x, y: a.y + n.y }];
}

export function buildPanels(piece: Piece, thicknessMm: number): PanelSolid[] {
  const inward = isClockwise(piece.outline) ? 1 : -1;
  const panels: PanelSolid[] = [];
  outlineEdges(piece.outline).forEach(([from, to], index) => {
    const edge = edgeAt(piece.edges, index);
    const path = [from, ...arcPoints(from, to, arcHeightOf(piece.edges, index)), to];
    const specs: Array<{ kind: PanelKind; height: number | undefined; thick: number; base: (h: number) => number }> = [
      { kind: 'splash', height: edge.splashHeightMm, thick: SPLASH_THICKNESS_MM, base: () => COUNTER_HEIGHT_MM },
      { kind: 'waterfall', height: edge.waterfallHeightMm, thick: thicknessMm, base: (h) => COUNTER_HEIGHT_MM - h },
    ];
    specs.forEach(({ kind, height, thick, base }) => {
      if (!height || height <= 0) return;
      path.slice(0, -1).forEach((a, k) => {
        const footprint = wall(a, path[k + 1], thick, inward);
        if (footprint.length === 0) return;
        panels.push({
          id: `${piece.id}:${index}:${kind}:${k}`,
          kind,
          footprint: transformOutline(footprint, piece.position, piece.rotationDeg),
          baseMm: base(height),
          heightMm: height,
        });
      });
    });
  });
  return panels;
}
