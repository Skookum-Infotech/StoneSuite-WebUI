// Marks the side settings on the canvas: the edge profile code at the middle
// of each finished side, a heavy line along a side that carries a backsplash,
// and a dashed one for a waterfall. Presentational only. Text, inset and
// stroke widths are in on-screen pixels (divided by the zoom), so they stay
// the same size however far the view is zoomed in or out.

import { memo, useMemo } from 'react';
import type { Piece } from '@/types/drawing';
import { MIN_READABLE_TEXT_PX } from '@/lib/drawing/constants';
import { outlineEdges, transformOutline } from '@/lib/drawing/geometry';
import { canvasTextScaleDivisor } from '@/lib/drawing/textScale';
import { useDrawingEditor } from './DrawingEditorContext';

const LABEL_INSET_PX = 16;
const LABEL_FONT_SIZE_PX = 11;
const SPLASH_STROKE_PX = 4;
const WATERFALL_STROKE_PX = 3;
const WATERFALL_DASH_PX = 8;
const WATERFALL_GAP_PX = 4;

interface Mark {
  key: number;
  a: { x: number; y: number };
  b: { x: number; y: number };
  code?: string;
  splash: boolean;
  waterfall: boolean;
  label: { x: number; y: number };
}

export const EdgeMarks = memo(function EdgeMarks({ piece }: { piece: Piece }) {
  const { state } = useDrawingEditor();
  // See canvasTextScaleDivisor.
  const divisor = canvasTextScaleDivisor(state.zoom, LABEL_FONT_SIZE_PX, MIN_READABLE_TEXT_PX);
  const px = (value: number) => value / divisor;
  const insetMm = px(LABEL_INSET_PX);
  const marks = useMemo<Mark[]>(() => {
    const sides = outlineEdges(transformOutline(piece.outline, piece.position, piece.rotationDeg));
    return piece.edges.flatMap((edge) => {
      const side = sides[edge.index];
      if (!side || !(edge.code || edge.splashHeightMm || edge.waterfallHeightMm)) return [];
      const [a, b] = side;
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      // The outline is clockwise (y up), so the piece lies to the right of
      // each side's direction of travel.
      const inward = { x: (b.y - a.y) / length, y: -(b.x - a.x) / length };
      return [{
        key: edge.index, a, b, code: edge.code,
        splash: Boolean(edge.splashHeightMm), waterfall: Boolean(edge.waterfallHeightMm),
        label: { x: (a.x + b.x) / 2 + inward.x * insetMm, y: (a.y + b.y) / 2 + inward.y * insetMm },
      }];
    });
  }, [piece.outline, piece.position, piece.rotationDeg, piece.edges, insetMm]);

  return (
    <g aria-hidden="true" pointerEvents="none">
      {marks.map((m) => (
        <g key={m.key}>
          {m.splash && (
            <line x1={m.a.x} y1={-m.a.y} x2={m.b.x} y2={-m.b.y} className="stroke-amber-500" strokeWidth={px(SPLASH_STROKE_PX)} />
          )}
          {m.waterfall && (
            <line
              x1={m.a.x} y1={-m.a.y} x2={m.b.x} y2={-m.b.y}
              className="stroke-sky-500" strokeWidth={px(WATERFALL_STROKE_PX)}
              strokeDasharray={`${px(WATERFALL_DASH_PX)} ${px(WATERFALL_GAP_PX)}`}
            />
          )}
          {m.code && (
            <text
              x={m.label.x} y={-m.label.y} textAnchor="middle" dominantBaseline="middle"
              fontSize={px(LABEL_FONT_SIZE_PX)} className="fill-stone-700"
            >
              {m.code}
            </text>
          )}
        </g>
      ))}
    </g>
  );
});
