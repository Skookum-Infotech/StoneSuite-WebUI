// The canvas half of the Profiles tool: a clickable strip along every side of
// every piece. The side under the pointer previews the picked profile type's
// colour; clicking paints it with the picked type and measurement (one undo
// step per click). Painting a side that already has that exact type and
// measurement changes nothing. Mirrors EdgePickLayer.

import { useState } from 'react';
import type { Piece, Point } from '@/types/drawing';
import { arcHeightOf, sidePath } from '@/lib/drawing/arcs';
import { paintProfileSide } from '@/lib/drawing/attachedProfileTypes';
import { EDGE_HIT_WIDTH_PX } from '@/lib/drawing/constants';
import { edgeAt } from '@/lib/drawing/edges';
import { outlineEdges, toWorldPoint } from '@/lib/drawing/geometry';
import { edgeLetter } from '@/lib/drawing/labels';
import { useDrawingEditor } from './DrawingEditorContext';
import { useSelectedProfileMeasurement } from './useSelectedProfileMeasurement';
import { useSelectedProfileType } from './useSelectedProfileType';

const PREVIEW_STROKE_PX = 5;
const PREVIEW_OPACITY = 0.7;

/** A local point as the canvas draws it: placed on the board, then y flipped. */
function toScreen(piece: Piece, local: Point): Point {
  const world = toWorldPoint(local, piece.position, piece.rotationDeg);
  return { x: world.x, y: -world.y };
}

function sideData(piece: Piece, index: number, from: Point, to: Point): string {
  const a = toScreen(piece, from);
  return `M${a.x},${a.y} ${sidePath(a, toScreen(piece, to), arcHeightOf(piece.edges, index))}`;
}

export function ProfilePickLayer() {
  const { state, dispatch } = useDrawingEditor();
  const selected = useSelectedProfileType();
  const measurementMm = useSelectedProfileMeasurement();
  const [hover, setHover] = useState<string | null>(null);
  const pieces = state.present.areas.find((a) => a.id === state.activeAreaId)?.pieces ?? [];

  const paint = (piece: Piece, index: number) => {
    if (!selected || measurementMm === undefined) return;
    const current = edgeAt(piece.edges, index).attachedProfile;
    if (current?.profileTypeId === selected.id && current?.measurementMm === measurementMm) return;
    dispatch({
      type: 'updatePiece', areaId: state.activeAreaId, pieceId: piece.id,
      patch: { edges: paintProfileSide(piece.edges, index, selected.id, measurementMm) },
    });
  };

  return (
    <g>
      {pieces.flatMap((piece) => outlineEdges(piece.outline).map(([from, to], i) => {
        const key = `${piece.id}:${i}`;
        const d = sideData(piece, i, from, to);
        return (
          <g key={key}>
            {selected && hover === key && (
              <path
                d={d}
                fill="none"
                stroke={selected.color}
                strokeOpacity={PREVIEW_OPACITY}
                strokeWidth={PREVIEW_STROKE_PX}
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
              onPointerEnter={() => setHover(key)}
              onPointerLeave={() => setHover((h) => (h === key ? null : h))}
              onPointerDown={(e) => {
                e.stopPropagation();
                paint(piece, i);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  paint(piece, i);
                }
              }}
            />
          </g>
        );
      }))}
    </g>
  );
}
