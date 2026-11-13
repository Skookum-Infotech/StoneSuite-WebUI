// The Draw tool's grab strips: a transparent, easy-to-hit line along every side
// of every piece in the active area, drawn above the tool's click-catching
// sheet so a press ON a side starts a resize instead of dropping a new square.
// The side under the pointer (or being dragged) lights up.
//
// The grab strips themselves always track the piece's ORIGINAL outline (never
// `edgeDrag.shown()`'s live preview), for two reasons: the element holding
// pointer capture must never move out from under the pointer, and growing a
// leg adds 2 corners, which would throw off a same-index pairing against the
// original. The highlight on the side actually being dragged uses
// `preview.highlight` instead: the live preview's moved points (leg included).

import type { Piece } from '@/types/drawing';
import { EDGE_HIT_WIDTH_PX } from '@/lib/drawing/constants';
import { outlineEdges, toWorldPoint } from '@/lib/drawing/geometry';
import { edgeLetter } from '@/lib/drawing/labels';
import type { EdgeDrag } from './useEdgeDrag';

export function EdgeDragLayer({ edgeDrag, pieces }: { edgeDrag: EdgeDrag; pieces: Piece[] }) {
  const { active, preview, dragging } = edgeDrag;

  const toScreen = (piece: Piece, local: { x: number; y: number }) => {
    const w = toWorldPoint(local, piece.position, piece.rotationDeg);
    return { x: w.x, y: -w.y };
  };

  return (
    <g>
      {pieces.map((piece) => (
        <g key={piece.id}>
          {outlineEdges(piece.outline).map(([a, b], i) => {
            const isActive = active?.pieceId === piece.id && active.index === i;
            const isPreviewed = isActive && preview?.pieceId === piece.id && preview.index === i;
            const highlightPoints = isPreviewed ? preview.highlight : [a, b];
            const bad = isPreviewed && !preview.valid;
            const ga = toScreen(piece, a);
            const gb = toScreen(piece, b);
            return (
              <g key={i}>
                {isActive && (
                  <polyline
                    points={highlightPoints.map((p) => { const s = toScreen(piece, p); return `${s.x},${s.y}`; }).join(' ')}
                    fill="none"
                    className={bad ? 'stroke-red-600' : 'stroke-brand'}
                    strokeWidth={4}
                    vectorEffect="non-scaling-stroke"
                    pointerEvents="none"
                    aria-hidden="true"
                  />
                )}
                <line
                  data-testid={`edge-grab-${piece.label}-${i}`}
                  role="button"
                  x1={ga.x} y1={ga.y} x2={gb.x} y2={gb.y}
                  aria-label={`Resize side ${edgeLetter(i)} of ${piece.label}`}
                  stroke="transparent"
                  strokeWidth={EDGE_HIT_WIDTH_PX}
                  vectorEffect="non-scaling-stroke"
                  className="cursor-grab outline-none"
                  onPointerEnter={() => { if (!dragging) edgeDrag.hover({ pieceId: piece.id, index: i }); }}
                  onPointerLeave={() => { if (!dragging) edgeDrag.hover(null); }}
                  onPointerDown={(e) => edgeDrag.begin(e, piece, i)}
                  onPointerMove={(e) => edgeDrag.update(e, piece)}
                  onPointerUp={(e) => edgeDrag.finish(e, piece)}
                  onContextMenu={(e) => e.preventDefault()}
                />
              </g>
            );
          })}
        </g>
      ))}
    </g>
  );
}
