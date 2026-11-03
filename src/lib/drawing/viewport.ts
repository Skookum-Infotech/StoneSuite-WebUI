// Screen <-> world (mm) coordinate conversion for the SVG canvas. Kept
// separate from geometry.ts (piece/outline math) since this is about the
// canvas's own screen-space rendering, not a piece's shape.
//
// Fixes a real bug found in the final review of this feature: the canvas
// previously treated one CSS pixel as exactly one viewBox unit, which is
// only true when the SVG happens to render at exactly VIEWPORT_WIDTH x
// VIEWPORT_HEIGHT pixels. Every real container is some other size, so
// drag-to-move and polygon clicks landed at the wrong world position
// everywhere except that one exact size. These functions correct for the
// SVG's actual rendered size (its `getBoundingClientRect()`).

import type { Point } from '@/types/drawing';
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from './constants';

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Scales a pixel distance on the rendered SVG into the same distance in
 *  viewBox units. */
export function pixelDeltaToViewboxUnits(
  dxPx: number,
  dyPx: number,
  rect: Pick<ViewportRect, 'width' | 'height'>,
): Point {
  return {
    x: dxPx * (VIEWPORT_WIDTH / rect.width),
    y: dyPx * (VIEWPORT_HEIGHT / rect.height),
  };
}

/** Converts a pixel distance (e.g. a drag's movementX/Y) into world
 *  millimetres: viewbox-scaled, then un-zoomed, then y-negated (world +y
 *  is up; SVG/screen +y is down). */
export function pixelDeltaToMm(
  dxPx: number,
  dyPx: number,
  rect: Pick<ViewportRect, 'width' | 'height'>,
  zoom: number,
): Point {
  const viewbox = pixelDeltaToViewboxUnits(dxPx, dyPx, rect);
  return { x: viewbox.x / zoom, y: -viewbox.y / zoom };
}

/** Converts an absolute screen point (e.g. a click's clientX/clientY) into
 *  world millimetres, inverting the canvas's own center-translate + pan +
 *  zoom transform chain. */
export function screenPointToMm(
  clientX: number,
  clientY: number,
  rect: ViewportRect,
  zoom: number,
  pan: Point,
): Point {
  const local = pixelDeltaToViewboxUnits(clientX - rect.left, clientY - rect.top, rect);
  const centered = { x: local.x - VIEWPORT_WIDTH / 2, y: local.y - VIEWPORT_HEIGHT / 2 };
  return { x: (centered.x - pan.x) / zoom, y: -(centered.y - pan.y) / zoom };
}
