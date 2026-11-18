// The canvas half of the Corner tool: a dot on every corner of every piece
// (the one under the pointer lights up — with the sides of its change, if it
// has one), the clicked corner kept lit, and a dashed preview of the piece as it
// will look once the typed numbers are applied.

import { useState } from 'react';
import type { Piece, Point } from '@/types/drawing';
import { arcHeightOf, outlinePath, sidePath } from '@/lib/drawing/arcs';
import { HANDLE_RADIUS_VB } from '@/lib/drawing/constants';
import { applyCorner, cornerChangeAt, cornerSides } from '@/lib/drawing/corners';
import { toWorldPoint } from '@/lib/drawing/geometry';
import { edgeLetter } from '@/lib/drawing/labels';
import { useDrawingEditor } from './DrawingEditorContext';
import type { CornerTarget } from './useCornerToolState';

const HIGHLIGHT_STROKE_PX = 4;
const PREVIEW_STROKE_PX = 2;
/** The clickable disc around a corner dot is this many times the dot. */
const HIT_AREA_SCALE = 2.4;

/** A local point as the canvas draws it: placed on the board, then y flipped. */
function toScreen(piece: Piece, local: Point): Point {
  const world = toWorldPoint(local, piece.position, piece.rotationDeg);
  return { x: world.x, y: -world.y };
}

function sideData(piece: Piece, index: number): string {
  const a = toScreen(piece, piece.outline[index]);
  const b = toScreen(piece, piece.outline[(index + 1) % piece.outline.length]);
  return `M${a.x},${a.y} ${sidePath(a, b, arcHeightOf(piece.edges, index))}`;
}

export function CornerPickLayer() {
  const { state, corner } = useDrawingEditor();
  const [hover, setHover] = useState<CornerTarget | null>(null);
  const pieces = state.present.areas.find((a) => a.id === state.activeAreaId)?.pieces ?? [];
  const radius = HANDLE_RADIUS_VB / state.zoom;

  const targetPiece = corner.target ? pieces.find((p) => p.id === corner.target?.pieceId) : undefined;
  const preview = targetPiece && corner.target
    ? applyCorner(targetPiece, corner.target.vertexIndex, corner.style, corner.params)
    : null;
  // The sides of a change light with its corner: it is one thing to the user.
  const litSides = new Set<string>();
  const litCorners = new Set<string>();
  for (const spot of [hover, corner.target]) {
    const owner = spot ? pieces.find((p) => p.id === spot.pieceId) : undefined;
    if (!spot || !owner) continue;
    litCorners.add(`${spot.pieceId}:${spot.vertexIndex}`);
    cornerChangeAt(owner.edges, spot.vertexIndex, owner.outline.length)?.sides.forEach((i) => litSides.add(`${spot.pieceId}:${i}`));
  }

  return (
    <g>
      {pieces.flatMap((piece) => [...litSides]
        .filter((key) => key.startsWith(`${piece.id}:`))
        .map((key) => (
          <path
            key={key}
            d={sideData(piece, Number(key.slice(piece.id.length + 1)))}
            fill="none"
            className="stroke-brand"
            strokeWidth={HIGHLIGHT_STROKE_PX}
            vectorEffect="non-scaling-stroke"
            pointerEvents="none"
          />
        )))}
      {pieces.flatMap((piece) => piece.outline.map((point, i) => {
        const key = `${piece.id}:${i}`;
        const at = toScreen(piece, point);
        const lit = litCorners.has(key);
        const { before, after } = cornerSides(i, piece.outline.length);
        const pick = () => corner.setTarget({ pieceId: piece.id, vertexIndex: i });
        return (
          <g key={key}>
            <circle
              cx={at.x}
              cy={at.y}
              r={lit ? radius * 1.4 : radius}
              className={lit ? 'fill-brand stroke-stone-900' : 'fill-stone-500 stroke-white'}
              strokeWidth={1}
              vectorEffect="non-scaling-stroke"
              pointerEvents="none"
            />
            <circle
              cx={at.x}
              cy={at.y}
              r={radius * HIT_AREA_SCALE}
              fill="transparent"
              role="button"
              tabIndex={0}
              aria-label={`Corner ${edgeLetter(before)} and ${edgeLetter(after)} of ${piece.label}`}
              className="cursor-pointer outline-none"
              onPointerEnter={() => setHover({ pieceId: piece.id, vertexIndex: i })}
              onPointerLeave={() => setHover((h) => (h?.pieceId === piece.id && h.vertexIndex === i ? null : h))}
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
