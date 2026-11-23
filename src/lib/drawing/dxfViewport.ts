// The zoom/pan arithmetic for an SVG viewBox shown with preserveAspectRatio
// "xMidYMid meet", the SVG default.

import type { DxfBounds } from './dxfSceneTypes';

export type ViewBox = { x: number; y: number; w: number; h: number };
export type ViewportRect = { left: number; top: number; width: number; height: number };

const FIT_MARGIN = 0.05;
const MIN_VIEW_SIZE = 1;
const MAX_ZOOM_IN = 200;
const MAX_ZOOM_OUT = 4;

export function fitViewBox(bounds: DxfBounds): ViewBox {
  const width = Math.max(bounds.maxX - bounds.minX, MIN_VIEW_SIZE);
  const height = Math.max(bounds.maxY - bounds.minY, MIN_VIEW_SIZE);
  const margin = Math.max(width, height) * FIT_MARGIN;
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerY = (bounds.minY + bounds.maxY) / 2;
  return {
    x: centerX - width / 2 - margin,
    y: centerY - height / 2 - margin,
    w: width + 2 * margin,
    h: height + 2 * margin,
  };
}

/** World units per screen pixel: the view scales to fit its tighter dimension. */
function unitsPerPixel(vb: ViewBox, rect: ViewportRect): number {
  return Math.max(vb.w / rect.width, vb.h / rect.height);
}

export function screenToWorld(vb: ViewBox, rect: ViewportRect, clientX: number, clientY: number) {
  const scale = unitsPerPixel(vb, rect);
  const bandX = (rect.width - vb.w / scale) / 2;
  const bandY = (rect.height - vb.h / scale) / 2;
  return {
    x: vb.x + (clientX - rect.left - bandX) * scale,
    y: vb.y + (clientY - rect.top - bandY) * scale,
  };
}

/** `factor` > 1 zooms in, keeping `focus` in place. Clamped relative to `fit`. */
export function zoomAt(vb: ViewBox, fit: ViewBox, factor: number, focus: { x: number; y: number }): ViewBox {
  const w = Math.min(Math.max(vb.w / factor, fit.w / MAX_ZOOM_IN), fit.w * MAX_ZOOM_OUT);
  const applied = vb.w / w;
  if (applied === 1) return vb;
  return {
    x: focus.x - (focus.x - vb.x) / applied,
    y: focus.y - (focus.y - vb.y) / applied,
    w,
    h: vb.h / applied,
  };
}

export function panBy(vb: ViewBox, dxPixels: number, dyPixels: number, rect: ViewportRect): ViewBox {
  if (rect.width === 0 || rect.height === 0) return vb;
  const scale = unitsPerPixel(vb, rect);
  return { ...vb, x: vb.x - dxPixels * scale, y: vb.y - dyPixels * scale };
}
