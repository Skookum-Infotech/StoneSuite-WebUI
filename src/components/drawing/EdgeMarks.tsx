// Marks the side settings on the canvas: the edge profile code at the middle
// of each finished side, a heavy line along a side that carries a backsplash,
// and a dashed one for a waterfall. Presentational only.

import { memo, useMemo } from 'react';
import type { Piece } from '@/types/drawing';
import { outlineEdges, transformOutline } from '@/lib/drawing/geometry';

const LABEL_INSET_MM = 22;
const LABEL_FONT_SIZE = 11;
const SPLASH_STROKE = 5;
const WATERFALL_STROKE = 4;

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
        label: { x: (a.x + b.x) / 2 + inward.x * LABEL_INSET_MM, y: (a.y + b.y) / 2 + inward.y * LABEL_INSET_MM },
      }];
    });
  }, [piece.outline, piece.position, piece.rotationDeg, piece.edges]);

  return (
    <g aria-hidden="true" pointerEvents="none">
      {marks.map((m) => (
        <g key={m.key}>
          {m.splash && (
            <line x1={m.a.x} y1={-m.a.y} x2={m.b.x} y2={-m.b.y} className="stroke-amber-500" strokeWidth={SPLASH_STROKE} />
          )}
          {m.waterfall && (
            <line
              x1={m.a.x} y1={-m.a.y} x2={m.b.x} y2={-m.b.y}
              className="stroke-sky-500" strokeWidth={WATERFALL_STROKE} strokeDasharray="8 4"
            />
          )}
          {m.code && (
            <text
              x={m.label.x} y={-m.label.y} textAnchor="middle" dominantBaseline="middle"
              fontSize={LABEL_FONT_SIZE} className="fill-stone-700"
            >
              {m.code}
            </text>
          )}
        </g>
      ))}
    </g>
  );
});
