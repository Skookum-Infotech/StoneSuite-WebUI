// The distance lines a cutout asks for (Cutout dialog > Distance Lines): a red
// line from its centre or border out to the piece's edge, with the distance in
// a pill on it, and a dot where it starts. They are part of editing a cutout,
// so they show in the Cutout tab only and are gone again in Sketch.

import type { Cutout, Piece } from '@/types/drawing';
import { TEXT_SCALE_FLOOR_ZOOM } from '@/lib/drawing/constants';
import { cutoutDistances } from '@/lib/drawing/cutoutDistances';
import { uprightTransform } from '@/lib/drawing/svgText';
import { formatLength } from '@/lib/drawing/units';
import { useDrawingEditor } from './DrawingEditorContext';

const FONT_SIZE_PX = 10;
const LINE_PX = 2;
const START_DOT_RADIUS_PX = 3;
const PILL_PAD_PX = 4;
const PILL_HEIGHT_PX = 14;
/** Average glyph width as a multiple of the font size, to size the pill. */
const GLYPH_WIDTH_EM = 0.6;

export function CutoutDistanceLines({ piece, cutout }: { piece: Piece; cutout: Cutout }) {
  const { state, workspace } = useDrawingEditor();
  if (workspace !== 'cutout') return null;
  const { displayUnit, fractionDenominator } = state.present;
  // See TEXT_SCALE_FLOOR_ZOOM.
  const px = (value: number) => value / Math.max(state.zoom, TEXT_SCALE_FLOOR_ZOOM);

  return (
    <g aria-hidden="true" pointerEvents="none">
      {cutoutDistances(piece, cutout).map(({ side, from, to, lengthMm }) => {
        const text = formatLength(lengthMm, displayUnit, fractionDenominator);
        const width = px(text.length * FONT_SIZE_PX * GLYPH_WIDTH_EM + PILL_PAD_PX * 2);
        const height = px(PILL_HEIGHT_PX);
        const middle = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        return (
          <g key={side}>
            <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} className="stroke-red-500" strokeWidth={px(LINE_PX)} />
            <circle cx={from.x} cy={from.y} r={px(START_DOT_RADIUS_PX)} className="fill-red-500" />
            <g transform={uprightTransform(middle, piece.rotationDeg)}>
              <rect x={-width / 2} y={-height / 2} width={width} height={height} rx={height / 2} className="fill-red-500" />
              <text textAnchor="middle" dominantBaseline="middle" fontSize={px(FONT_SIZE_PX)} className="fill-white font-medium">{text}</text>
            </g>
          </g>
        );
      })}
    </g>
  );
}
