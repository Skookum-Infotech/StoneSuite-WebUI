// Renders one dimension on the SVG canvas, in the shop-drawing shape: thin
// extension lines running out from the two measured points, a DASHED
// dimension line between them with a solid tick at each end, and the
// measurement — prefixed with the side's letter where it has one
// ("B: 121.7"") — sitting on the line with a white halo behind it.
// Purely presentational: nothing on it is interactive, so it stays out of
// the tab order and screen readers skip it.
//
// Strokes and text are divided by the current zoom, so they stay the same
// size on screen however far the drawing is zoomed out — the whole point of
// a dimension is that it can be read.

import type { Point } from '@/types/drawing';
import type { DimensionLineLayout } from '@/lib/drawing/dimensions';
import { formatLength } from '@/lib/drawing/units';
import { useDrawingEditor } from './DrawingEditorContext';

const FONT_SIZE_PX = 12;
const STROKE_PX = 1;
const TICK_PX = 5;
/** How far the extension line stops short of the point it measures. */
const EXTENSION_GAP_PX = 3;
/** How far it carries on past the dimension line. */
const EXTENSION_OVERSHOOT_PX = 3;
/** The dimension line's own dash and gap. */
const DASH_PX = 5;
const DASH_GAP_PX = 3;
/** The measurement sits ON its dimension line, with a white halo cutting the
 *  line behind it — the CAD convention. That keeps each dimension to a single
 *  compact strip instead of a line plus a label floating beside it, which is
 *  what made neighbouring sides' labels pile up at the corners. */
const HALO_PX = 4;
/** Average glyph width as a multiple of the font size (a safe over-estimate)
 *  and the clear space wanted either side of the text. */
const GLYPH_WIDTH_EM = 0.62;
const TEXT_CLEARANCE_PX = 10;

/** World coordinates treat +y as "up" (geometry.ts/dimensions.ts); SVG y grows
 *  downward — negate every y the moment a world point reaches markup. */
function toSvg(p: Point): Point {
  return { x: p.x, y: -p.y };
}

export function DimensionLine(
  { layout, displayUnit, fractionDenominator, letter }: {
    layout: DimensionLineLayout;
    displayUnit: 'in' | 'mm';
    fractionDenominator: 16 | 32;
    letter?: string;
  },
) {
  const { state } = useDrawingEditor();
  const from = toSvg(layout.lineFrom);
  const to = toSvg(layout.lineTo);
  const edgeFrom = toSvg(layout.edgeFrom);
  const edgeTo = toSvg(layout.edgeTo);
  const textAt = toSvg(layout.textAt);

  // Everything below is in world units; dividing by the zoom gives a constant
  // on-screen size, since the canvas draws inside a scale(zoom) group.
  const px = (value: number) => value / state.zoom;
  const label = `${letter ? `${letter}: ` : ''}${formatLength(layout.lengthMm, displayUnit, fractionDenominator)}`;

  // "Outward" is whichever way the dimension line was already offset from the
  // measured edge — the text and the extension lines both follow it, so they
  // land on the free side whatever the edge's direction.
  const offset = { x: from.x - edgeFrom.x, y: from.y - edgeFrom.y };
  const offsetLength = Math.hypot(offset.x, offset.y) || 1;
  const outward = { x: offset.x / offsetLength, y: offset.y / offsetLength };
  const along = { x: -outward.y, y: outward.x };
  const tick = px(TICK_PX);
  // The y-flip reverses the sense of rotation: a world angle of +θ is -θ on
  // screen, which is what keeps a vertical dimension reading bottom-to-top
  // instead of upside down.
  const textRotation = -layout.rotationDeg;

  const extension = (point: Point, end: Point) => (
    <line
      x1={point.x + outward.x * px(EXTENSION_GAP_PX)}
      y1={point.y + outward.y * px(EXTENSION_GAP_PX)}
      x2={end.x + outward.x * px(EXTENSION_OVERSHOOT_PX)}
      y2={end.y + outward.y * px(EXTENSION_OVERSHOOT_PX)}
      stroke="currentColor"
      strokeWidth={px(STROKE_PX)}
      className="text-stone-300"
    />
  );
  // A side too short on screen to hold its measurement keeps its line and
  // ticks but drops the text, rather than printing over its neighbours'.
  const lineLengthPx = layout.lengthMm * state.zoom;
  const showLabel = lineLengthPx >= label.length * GLYPH_WIDTH_EM * FONT_SIZE_PX + TEXT_CLEARANCE_PX * 2;

  return (
    <g aria-hidden="true" pointerEvents="none">
      {extension(edgeFrom, from)}
      {extension(edgeTo, to)}
      <line
        x1={from.x} y1={from.y} x2={to.x} y2={to.y}
        stroke="currentColor" strokeWidth={px(STROKE_PX)} className="text-stone-500"
        strokeDasharray={`${px(DASH_PX)} ${px(DASH_GAP_PX)}`}
      />
      <line
        x1={from.x - along.x * tick} y1={from.y - along.y * tick}
        x2={from.x + along.x * tick} y2={from.y + along.y * tick}
        stroke="currentColor" strokeWidth={px(STROKE_PX)} className="text-stone-500"
      />
      <line
        x1={to.x - along.x * tick} y1={to.y - along.y * tick}
        x2={to.x + along.x * tick} y2={to.y + along.y * tick}
        stroke="currentColor" strokeWidth={px(STROKE_PX)} className="text-stone-500"
      />
      {showLabel && (
        <text
          x={textAt.x}
          y={textAt.y}
          transform={`rotate(${textRotation} ${textAt.x} ${textAt.y})`}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={px(FONT_SIZE_PX)}
          strokeWidth={px(HALO_PX)}
          strokeLinejoin="round"
          paintOrder="stroke"
          className="fill-stone-800 stroke-white font-medium"
        >
          {label}
        </text>
      )}
    </g>
  );
}
