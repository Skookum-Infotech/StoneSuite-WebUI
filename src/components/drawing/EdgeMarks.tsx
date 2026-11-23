// Marks the side settings on the canvas: the edge profile code at the middle
// of each finished side. (Attached profiles — Backsplash, Waterfall, etc. —
// render as their own unfolded piece via AttachedProfilePieces, not a line
// here.) Presentational only. Text, inset and stroke widths are in on-screen
// pixels (divided by the zoom), so they stay the same size however far the
// view is zoomed in or out.

import { memo, useMemo } from 'react';
import type { Piece } from '@/types/drawing';
import { MIN_READABLE_TEXT_PX } from '@/lib/drawing/constants';
import { outlineEdges, transformOutline } from '@/lib/drawing/geometry';
import { canvasTextScaleDivisor } from '@/lib/drawing/textScale';
import { useDrawingEditor } from './DrawingEditorContext';

const LABEL_INSET_PX = 16;
const LABEL_FONT_SIZE_PX = 11;

interface Mark {
  key: number;
  code: string;
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
      if (!side || !edge.code) return [];
      const [a, b] = side;
      const length = Math.hypot(b.x - a.x, b.y - a.y) || 1;
      // The outline is clockwise (y up), so the piece lies to the right of
      // each side's direction of travel.
      const inward = { x: (b.y - a.y) / length, y: -(b.x - a.x) / length };
      return [{
        key: edge.index, code: edge.code,
        label: { x: (a.x + b.x) / 2 + inward.x * insetMm, y: (a.y + b.y) / 2 + inward.y * insetMm },
      }];
    });
  }, [piece.outline, piece.position, piece.rotationDeg, piece.edges, insetMm]);

  return (
    <g aria-hidden="true" pointerEvents="none">
      {marks.map((m) => (
        <text
          key={m.key}
          x={m.label.x} y={-m.label.y} textAnchor="middle" dominantBaseline="middle"
          fontSize={px(LABEL_FONT_SIZE_PX)} className="fill-stone-700"
        >
          {m.code}
        </text>
      ))}
    </g>
  );
});
