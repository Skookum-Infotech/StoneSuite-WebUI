// Renders one dimension on the SVG canvas, in the shop-drawing shape: dotted
// extension lines running out from the two measured points, a solid dimension
// line between them with a tick at each end, and the measurement — prefixed
// with the side's letter where it has one ("B: 121.7""). Purely
// presentational: nothing on it is interactive, so it stays out of the tab
// order and screen readers skip it.
//
// Strokes and text are divided by the current zoom, so they stay the same
// size on screen however far the drawing is zoomed out — the whole point of
// a dimension is that it can be read.

import type { Point } from '@/types/drawing';
import type { DimensionLineLayout } from '@/lib/drawing/dimensions';
import { formatLength } from '@/lib/drawing/units';
import { useDrawingEditor } from './DrawingEditorContext';

const FONT_SIZE_PX = 11;
const STROKE_PX = 1;
const TICK_PX = 4;
/** Clear of the dimension line itself, so the text never sits on the stroke. */
const TEXT_GAP_PX = 5;
/** How far the extension line stops short of the point it measures. */
const EXTENSION_GAP_PX = 3;
/** How far it carries on past the dimension line. */
const EXTENSION_OVERSHOOT_PX = 4;

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
      strokeDasharray={`${px(2)} ${px(2)}`}
      opacity={0.6}
    />
  );

  return (
    <g aria-hidden="true" className="text-stone-500" pointerEvents="none">
      {extension(edgeFrom, from)}
      {extension(edgeTo, to)}
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="currentColor" strokeWidth={px(STROKE_PX)} />
      <line
        x1={from.x - along.x * tick} y1={from.y - along.y * tick}
        x2={from.x + along.x * tick} y2={from.y + along.y * tick}
        stroke="currentColor" strokeWidth={px(STROKE_PX)}
      />
      <line
        x1={to.x - along.x * tick} y1={to.y - along.y * tick}
        x2={to.x + along.x * tick} y2={to.y + along.y * tick}
        stroke="currentColor" strokeWidth={px(STROKE_PX)}
      />
      <text
        x={textAt.x + outward.x * px(TEXT_GAP_PX)}
        y={textAt.y + outward.y * px(TEXT_GAP_PX)}
        transform={`rotate(${textRotation} ${textAt.x} ${textAt.y})`}
        textAnchor="middle"
        fontSize={px(FONT_SIZE_PX)}
        className="fill-stone-700 font-medium"
      >
        {label}
      </text>
    </g>
  );
}
