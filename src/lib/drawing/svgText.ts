// Text inside a piece's own coordinate group. That group is drawn with the
// piece's rotation and a y-flip (PieceShape), which would turn text upside
// down or sideways; this is the transform that puts it back upright at a point.

import type { Point } from '@/types/drawing';

/** SVG transform that places upright, screen-aligned text at `at` (local
 *  coordinates) inside a group drawn rotated by `pieceRotationDeg` and flipped. */
export const uprightTransform = (at: Point, pieceRotationDeg: number): string =>
  `translate(${at.x},${at.y}) scale(1,-1) rotate(${-pieceRotationDeg})`;
