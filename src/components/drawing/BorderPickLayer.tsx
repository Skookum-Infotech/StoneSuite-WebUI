// The canvas half of the Border tool: a clickable strip along every side of
// every piece (the side under the pointer lights up — with the rest of its
// border, if it has one), the clicked side kept lit, and a dashed preview of
// the piece as it will look once the typed numbers are applied.

import { useState } from 'react';
import type { Piece, Point } from '@/types/drawing';
import { arcHeightOf, outlinePath, sidePath } from '@/lib/drawing/arcs';
import { applyBorder, borderGroup } from '@/lib/drawing/borders';
import { EDGE_HIT_WIDTH_PX } from '@/lib/drawing/constants';
import { outlineEdges, toWorldPoint } from '@/lib/drawing/geometry';
import { edgeLetter } from '@/lib/drawing/labels';
import { useDrawingEditor } from './DrawingEditorContext';
import type { BorderTarget } from './useBorderToolState';

const HIGHLIGHT_STROKE_PX = 4;
const PREVIEW_STROKE_PX = 2;

/** A local point as the canvas draws it: placed on the board, then y flipped. */
function toScreen(piece: Piece, local: Point): Point {
  const world = toWorldPoint(local, piece.position, piece.rotationDeg);
  return { x: world.x, y: -world.y };
}

function sideData(piece: Piece, index: number, from: Point, to: Point): string {
  const a = toScreen(piece, from);
  return `M${a.x},${a.y} ${sidePath(a, toScreen(piece, to), arcHeightOf(piece.edges, index))}`;
}

export function BorderPickLayer() {
  const { state, border } = useDrawingEditor();
  const [hover, setHover] = useState<BorderTarget | null>(null);
  const pieces = state.present.areas.find((a) => a.id === state.activeAreaId)?.pieces ?? [];

  const targetPiece = border.target ? pieces.find((p) => p.id === border.target?.pieceId) : undefined;
  const preview = targetPiece && border.target
    ? applyBorder(targetPiece, border.target.edgeIndex, border.style, border.params)
    : null;
  // Every side of a border lights together: it is one thing to the user.
  const litKeys = new Set<string>();
  for (const spot of [hover, border.target]) {
    const owner = spot ? pieces.find((p) => p.id === spot.pieceId) : undefined;
    if (spot && owner) borderGroup(owner.edges, spot.edgeIndex).forEach((i) => litKeys.add(`${spot.pieceId}:${i}`));
  }

  return (
    <g>
      {pieces.flatMap((piece) => outlineEdges(piece.outline).map(([from, to], i) => {
        const key = `${piece.id}:${i}`;
        const d = sideData(piece, i, from, to);
        const lit = litKeys.has(key);
        const pick = () => border.setTarget({ pieceId: piece.id, edgeIndex: i });
        return (
          <g key={key}>
            {lit && (
              <path
                d={d}
                fill="none"
                className="stroke-brand"
                strokeWidth={HIGHLIGHT_STROKE_PX}
                vectorEffect="non-scaling-stroke"
                pointerEvents="none"
              />
            )}
            <path
              d={d}
              fill="none"
              role="button"
              tabIndex={0}
              aria-label={`Side ${edgeLetter(i)} of ${piece.label}`}
              stroke="transparent"
              strokeWidth={EDGE_HIT_WIDTH_PX}
              vectorEffect="non-scaling-stroke"
              className="cursor-pointer outline-none"
              onPointerEnter={() => setHover({ pieceId: piece.id, edgeIndex: i })}
              onPointerLeave={() => setHover((h) => (h?.pieceId === piece.id && h.edgeIndex === i ? null : h))}
              onPointerDown={(e) => {
                e.stopPropagation();
                pick();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  pick();
                }
              }}
            />
          </g>
        );
      }))}
      {targetPiece && preview?.ok && (
        <path
          d={outlinePath(preview.outline.map((p) => toScreen(targetPiece, p)), preview.edges)}
          fill="none"
          strokeDasharray="6 4"
          className="stroke-brand"
          strokeWidth={PREVIEW_STROKE_PX}
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
          aria-hidden="true"
        />
      )}
    </g>
  );
}
