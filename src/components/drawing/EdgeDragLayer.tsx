// The Draw tool's grab strips: a transparent, easy-to-hit line along every side
// of every piece in the active area, drawn above the tool's click-catching
// sheet so a press ON a side starts a resize instead of dropping a new square.
// The side under the pointer (or being dragged) lights up.

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
      {pieces.map((piece) => {
        const shown = edgeDrag.shown(piece);
        return (
          <g key={piece.id}>
            {outlineEdges(shown.outline).map(([a, b], i) => {
              const isActive = active?.pieceId === piece.id && active.index === i;
              const sa = toScreen(piece, a);
              const sb = toScreen(piece, b);
              // The grab strip follows the ORIGINAL outline while a drag is on,
              // so the element holding the pointer capture never moves.
              const [oa, ob] = outlineEdges(piece.outline)[i];
              const ga = toScreen(piece, oa);
              const gb = toScreen(piece, ob);
              const bad = isActive && preview?.pieceId === piece.id && !preview.valid;
              return (
                <g key={i}>
                  {isActive && (
                    <line
                      x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y}
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
        );
      })}
    </g>
  );
}
