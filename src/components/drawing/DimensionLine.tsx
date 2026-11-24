// Renders one dimension on the SVG canvas, in the shop-drawing shape: a dot
// on each measured point, a DASHED extension line running straight out from
// each one to the dimension line, and a DASHED dimension line between them,
// so the three join into one clean bracket with square corners. The
// measurement — prefixed with the side's letter where it has one
// ("B: 121.7"") — sits on the line with a white halo behind it.
// Purely presentational: nothing on it is interactive, so it stays out of
// the tab order and screen readers skip it.
//
// Strokes, dots and text are scaled by canvasTextScaleDivisor, so they stay
// the same size on screen across the normal editing range — the whole point
// of a dimension is that it can be read. Past TEXT_SCALE_FLOOR_ZOOM (zoomed
// out to see a whole multi-piece layout) they shrink with the drawing
// instead, so they don't pile up oversized on top of each other — down to
// MIN_READABLE_TEXT_PX, below which they hold instead of vanishing.

import type { Point } from '@/types/drawing';
import type { DimensionLineLayout } from '@/lib/drawing/dimensions';
import { DIMENSION_FONT_SIZE_PX, MIN_READABLE_TEXT_PX } from '@/lib/drawing/constants';
import { canvasTextScaleDivisor } from '@/lib/drawing/textScale';
import { formatLength } from '@/lib/drawing/units';
import { useDrawingEditor } from './DrawingEditorContext';

const STROKE_PX = 1.25;
/** The dot on each measured point (the piece's corner). */
const POINT_RADIUS_PX = 2.5;
/** The dash and gap shared by the extension lines and the dimension line. */
const DASH_PX = 5;
const DASH_GAP_PX = 3;
/** The measurement sits ON its dimension line, with a white halo cutting the
 *  line behind it — the CAD convention. That keeps each dimension to a single
 *  compact strip instead of a line plus a label floating beside it. */
const HALO_PX = 4;

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

  // Everything below is in world units; see canvasTextScaleDivisor for what
  // dividing by it does at each zoom.
  const divisor = canvasTextScaleDivisor(state.zoom, DIMENSION_FONT_SIZE_PX, MIN_READABLE_TEXT_PX);
  const px = (value: number) => value / divisor;
  const label = `${letter ? `${letter}: ` : ''}${formatLength(layout.lengthMm, displayUnit, fractionDenominator)}`;
  // The y-flip reverses the sense of rotation: a world angle of +θ is -θ on
  // screen, which is what keeps a vertical dimension reading bottom-to-top
  // instead of upside down.
  const textRotation = -layout.rotationDeg;

  // Every dashed segment STARTS at a bracket corner (where an extension line
  // meets the dimension line), so each one opens with a dash there; square caps then
  // fill the notch between the two, and the corner reads as one joined L
  // instead of two lines that happen to stop near each other.
  const dashed = (a: Point, b: Point, tone: string) => (
    <line
      x1={a.x} y1={a.y} x2={b.x} y2={b.y}
      stroke="currentColor"
      strokeWidth={px(STROKE_PX)}
      strokeDasharray={`${px(DASH_PX)} ${px(DASH_GAP_PX)}`}
      strokeLinecap="square"
      className={tone}
    />
  );
  const dot = (p: Point) => (
    <circle cx={p.x} cy={p.y} r={px(POINT_RADIUS_PX)} fill="currentColor" className="text-ink-muted" />
  );
  // A zero-offset dimension (a circle's radius) has no extension lines.
  const hasExtension = from.x !== edgeFrom.x || from.y !== edgeFrom.y;

  return (
    <g aria-hidden="true" pointerEvents="none">
      {hasExtension && dashed(from, edgeFrom, 'text-ink-muted')}
      {hasExtension && dashed(to, edgeTo, 'text-ink-muted')}
      {/* The dimension line in two halves, each dashed from its own corner
       *  inward; they meet in the middle, under the measurement's halo. */}
      {dashed(from, textAt, 'text-ink-muted')}
      {dashed(to, textAt, 'text-ink-muted')}
      {dot(edgeFrom)}
      {dot(edgeTo)}
      {/* Always shown, at every zoom: a measurement that disappears when the
       *  view is zoomed out is no use to anyone reading the whole layout. */}
      <text
        x={textAt.x}
        y={textAt.y}
        transform={`rotate(${textRotation} ${textAt.x} ${textAt.y})`}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={px(DIMENSION_FONT_SIZE_PX)}
        strokeWidth={px(HALO_PX)}
        strokeLinejoin="round"
        paintOrder="stroke"
        className="fill-stone-800 stroke-white font-semibold"
      >
        {label}
      </text>
    </g>
  );
}
