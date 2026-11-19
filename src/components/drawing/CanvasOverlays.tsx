// Transient shapes drawn over the canvas while a gesture is in progress: the
// shift-drag selection rectangle and the polygon being drawn.

import type { Point } from '@/types/drawing';
import { CLOSE_POLYGON_HIT_PX, DIMENSION_FONT_SIZE_PX, DIMENSION_OFFSET_PX, MIN_READABLE_TEXT_PX } from '@/lib/drawing/constants';
import { layoutDimension } from '@/lib/drawing/dimensions';
import { canvasTextScaleDivisor } from '@/lib/drawing/textScale';
import { DimensionLine } from './DimensionLine';

export interface Marquee {
  from: Point;
  to: Point;
}

const MIN_POLYGON_POINTS_TO_CLOSE = 3;

/** The draft polygon's own border weight and colour — the same sharp, solid
 *  line a finished piece gets (PieceShape's PIECE_STROKE_PX / stroke-stone-900),
 *  not a dashed brand-coloured preview, so the shape being drawn already
 *  looks like the real border it will have. Divided by zoom so it stays that
 *  weight on screen at any zoom instead of the default hairline (which all
 *  but disappears zoomed out, e.g. the editor's own opening zoom). */
const DRAFT_STROKE_PX = 2;

export function CanvasOverlays({ marquee, draftPoints, cursorPoint, zoom, dimensionsOn, displayUnit, fractionDenominator }: {
  marquee: Marquee | null;
  draftPoints: Point[];
  cursorPoint: Point | null;
  zoom: number;
  /** The bottom bar's Dimensions switch — while on, each side already drawn
   *  (and the one not yet placed, following the cursor) shows its own live
   *  length, the same way a finished piece's sides do. */
  dimensionsOn: boolean;
  displayUnit: 'in' | 'mm';
  fractionDenominator: 16 | 32;
}) {
  const last = draftPoints[draftPoints.length - 1];
  const canClose = draftPoints.length >= MIN_POLYGON_POINTS_TO_CLOSE;
  const draftStrokeWidth = DRAFT_STROKE_PX / zoom;
  // Consecutive pairs only — unlike a finished piece's outlineEdges, this
  // must NOT wrap the last point back to the first: that side doesn't exist
  // yet, and showing its length before the shape is even closed would lie.
  const draftEdges: [Point, Point][] = draftPoints.slice(1).map((p, i) => [draftPoints[i], p]);
  // Same stand-off rule PieceDimensions uses, so a side's length reads the
  // same before and after the shape is finalized.
  const dimensionOffsetMm = DIMENSION_OFFSET_PX / canvasTextScaleDivisor(zoom, DIMENSION_FONT_SIZE_PX, MIN_READABLE_TEXT_PX);
  return (
    <>
      {marquee && (
        <rect
          x={Math.min(marquee.from.x, marquee.to.x)}
          y={-Math.max(marquee.from.y, marquee.to.y)}
          width={Math.abs(marquee.to.x - marquee.from.x)}
          height={Math.abs(marquee.to.y - marquee.from.y)}
          className="fill-brand/10 stroke-brand"
          strokeDasharray="4 4"
          aria-hidden="true"
        />
      )}
      {draftPoints.length > 0 && (
        <polyline
          points={draftPoints.map((p) => `${p.x},${-p.y}`).join(' ')}
          fill="none"
          className="stroke-stone-900"
          strokeWidth={draftStrokeWidth}
          aria-hidden="true"
        />
      )}
      {/* The next side, following the cursor to the point not yet placed —
       *  without it the border stops at the last click and the shape looks
       *  unfinished/invisible beyond that, instead of a continuous border. */}
      {last && cursorPoint && (
        <line
          x1={last.x} y1={-last.y} x2={cursorPoint.x} y2={-cursorPoint.y}
          className="stroke-stone-900"
          strokeWidth={draftStrokeWidth}
          aria-hidden="true"
        />
      )}
      {dimensionsOn && draftEdges.map(([a, b], i) => (
        // Index key: same reasoning as the close-target rings below.
        <DimensionLine
          key={i}
          layout={layoutDimension(a, b, dimensionOffsetMm)}
          displayUnit={displayUnit}
          fractionDenominator={fractionDenominator}
        />
      ))}
      {dimensionsOn && last && cursorPoint && (
        <DimensionLine
          layout={layoutDimension(last, cursorPoint, dimensionOffsetMm)}
          displayUnit={displayUnit}
          fractionDenominator={fractionDenominator}
        />
      )}
      {/* Every point already down is a valid place to close it — not just
       *  the first (DrawingCanvas's own click-any-existing-point rule) — so
       *  each one gets the same ring, at exactly the radius that hit test
       *  uses (CLOSE_POLYGON_HIT_PX / zoom): what's shown as clickable always is. */}
      {canClose && draftPoints.map((p, i) => (
        // Index key: a draft point has no id of its own, and the whole list
        // is replaced wholesale on every click (same as PieceShape's seams).
        <circle
          key={i}
          cx={p.x}
          cy={-p.y}
          r={CLOSE_POLYGON_HIT_PX / zoom}
          className="fill-brand/40 stroke-brand"
          strokeWidth={1.5 / zoom}
          aria-hidden="true"
        />
      ))}
    </>
  );
}
