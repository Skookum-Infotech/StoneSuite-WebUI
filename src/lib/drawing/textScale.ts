// The divisor a canvas component divides every on-screen size by (text,
// strokes, dots, stand-off distances) — one number per render, applied
// uniformly to every value in that component, so they all shrink together
// and stay in proportion with one another:
//   - 1 : zoom across the normal editing range (TEXT_SCALE_FLOOR_ZOOM and
//     above), so nothing looks bigger or smaller just from zooming in or out.
//   - zoom : TEXT_SCALE_FLOOR_ZOOM below that, so a zoomed-out multi-piece
//     layout doesn't pile up oversized, overlapping text (see that
//     constant's own comment).
//   - held fixed once that shrink would take `referencePx` — the size of the
//     one piece of text calling this is built around (a piece label's own
//     font size, a dimension's) — below `minPx` on screen: a job large or
//     spread-out enough to need a zoom this extreme would otherwise shrink
//     its labels into illegible specks. Past this point a label may overlap
//     its neighbour again instead — a number you can still read beats one
//     that has vanished.

import { TEXT_SCALE_FLOOR_ZOOM } from './constants';

export function canvasTextScaleDivisor(zoom: number, referencePx: number, minPx: number): number {
  const flooredZoom = Math.max(zoom, TEXT_SCALE_FLOOR_ZOOM);
  const screenPx = (referencePx / flooredZoom) * zoom;
  if (screenPx >= minPx) return flooredZoom;
  // Solve for the divisor that puts `referencePx` exactly at `minPx` on
  // screen instead: screenPx = referencePx * zoom / divisor = minPx.
  return (referencePx * zoom) / minPx;
}
