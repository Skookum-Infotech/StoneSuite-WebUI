// Pure math for the corner map: which part of the drawing the canvas is
// showing, how the whole drawing fits into the small map box, and the
// conversions between a point in that box and a point on the drawing. All
// world values are millimetres with +y up, the editor's own convention.

import type { Piece, Point } from '@/types/drawing';
import { VIEWPORT_HEIGHT, VIEWPORT_WIDTH } from './constants';
import { bounds, transformOutline } from './geometry';

export interface WorldRect {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** How a world extent is laid into a `boxW` x `boxH` pixel box: uniform scale,
 *  centred, with `extent` the part of the world the box shows. */
export interface MapFit {
  extent: WorldRect;
  scale: number;
  offsetX: number;
  offsetY: number;
}

/** Breathing room around the drawing in the map, as a share of its larger side. */
const MAP_PADDING_RATIO = 0.1;

/** Padding used when the drawing has no size to take a share of (nothing drawn). */
const MIN_PADDING_MM = 100;

/** The world area the canvas is showing. The canvas keeps its 800x600 viewBox
 *  and scales it to the tighter side of the element ("meet"), so one pixel is
 *  the same number of viewBox units both ways; the centre of the element is the
 *  world point `-pan / zoom` (y flipped). */
export function viewportRect(pan: Point, zoom: number, widthPx: number, heightPx: number): WorldRect {
  const unitsPerPx = Math.max(VIEWPORT_WIDTH / widthPx, VIEWPORT_HEIGHT / heightPx);
  const halfWidth = (widthPx * unitsPerPx) / zoom / 2;
  const halfHeight = (heightPx * unitsPerPx) / zoom / 2;
  const centerX = -pan.x / zoom;
  const centerY = pan.y / zoom;
  return { minX: centerX - halfWidth, maxX: centerX + halfWidth, minY: centerY - halfHeight, maxY: centerY + halfHeight };
}

/** The box around every piece, or null when there are none. */
export function piecesBounds(pieces: Piece[]): WorldRect | null {
  if (pieces.length === 0) return null;
  return bounds(pieces.flatMap((p) => transformOutline(p.outline, p.position, p.rotationDeg)));
}

export function unionRects(a: WorldRect, b: WorldRect): WorldRect {
  return {
    minX: Math.min(a.minX, b.minX), minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX), maxY: Math.max(a.maxY, b.maxY),
  };
}

/** `rect` grown on every side, so what it holds never touches the map's edge. */
export function padRect(rect: WorldRect): WorldRect {
  const larger = Math.max(rect.maxX - rect.minX, rect.maxY - rect.minY);
  const pad = Math.max(larger * MAP_PADDING_RATIO, MIN_PADDING_MM);
  return { minX: rect.minX - pad, minY: rect.minY - pad, maxX: rect.maxX + pad, maxY: rect.maxY + pad };
}

/** What the map should show: the drawing and the current view together, so the
 *  view box is always on the map however far the user has panned. */
export function mapExtent(drawing: WorldRect | null, view: WorldRect): WorldRect {
  return padRect(drawing ? unionRects(drawing, view) : view);
}

export function fitExtent(extent: WorldRect, boxW: number, boxH: number): MapFit {
  const width = extent.maxX - extent.minX;
  const height = extent.maxY - extent.minY;
  const scale = Math.min(boxW / width, boxH / height);
  return { extent, scale, offsetX: (boxW - width * scale) / 2, offsetY: (boxH - height * scale) / 2 };
}

/** A pixel in the map box -> the point of the drawing under it. */
export function boxToWorld(x: number, y: number, fit: MapFit): Point {
  return {
    x: (x - fit.offsetX) / fit.scale + fit.extent.minX,
    y: fit.extent.maxY - (y - fit.offsetY) / fit.scale,
  };
}

export function rectCenter(rect: WorldRect): Point {
  return { x: (rect.minX + rect.maxX) / 2, y: (rect.minY + rect.maxY) / 2 };
}

export function rectContains(rect: WorldRect, point: Point): boolean {
  return point.x >= rect.minX && point.x <= rect.maxX && point.y >= rect.minY && point.y <= rect.maxY;
}
