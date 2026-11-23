// Screen <-> world (mm) coordinate conversion for the SVG canvas. Kept
// separate from geometry.ts (piece/outline math) since this is about the
// canvas's own screen-space rendering, not a piece's shape.
//
// The canvas fills whatever room the page gives it, so one CSS pixel is not
// one viewBox unit: drag-to-move and polygon clicks would otherwise land at
// the wrong world position everywhere except one exact size. These functions
// correct for the SVG's actual rendered size (its `getBoundingClientRect()`),
// using the same fit-and-centre rule the SVG itself applies.

import type { Point } from '@/types/drawing';
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from './constants';

export interface ViewportRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** ViewBox units per pixel. The canvas fills whatever room the page gives it,
 *  and the SVG keeps its drawing's proportions by scaling the viewBox to the
 *  tighter of the two dimensions ("meet") and centring it, so one pixel is the
 *  same number of units in both directions. */
function viewboxUnitsPerPixel(rect: Pick<ViewportRect, 'width' | 'height'>): number {
  return Math.max(VIEWPORT_WIDTH / rect.width, VIEWPORT_HEIGHT / rect.height);
}

/** Scales a pixel distance on the rendered SVG into the same distance in
 *  viewBox units. */
export function pixelDeltaToViewboxUnits(
  dxPx: number,
  dyPx: number,
  rect: Pick<ViewportRect, 'width' | 'height'>,
): Point {
  const scale = viewboxUnitsPerPixel(rect);
  return { x: dxPx * scale, y: dyPx * scale };
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
  // The viewBox is centred in the element, so its centre (the world origin
  // before pan and zoom) is the element's centre, whatever the proportions.
  const centered = pixelDeltaToViewboxUnits(
    clientX - rect.left - rect.width / 2,
    clientY - rect.top - rect.height / 2,
    rect,
  );
  return { x: (centered.x - pan.x) / zoom, y: -(centered.y - pan.y) / zoom };
}
