// The colour of each side the Edges tool has painted, drawn as a band along the
// piece's outline. Takes the piece's outline already placed on the board (so it
// follows a drag preview) and, like the outline, keeps the same weight on screen
// at any zoom. A curved side is coloured along its arc.

import type { EdgeType, Piece, Point } from '@/types/drawing';
import { arcHeightOf, sidePath } from '@/lib/drawing/arcs';
import { paintedSides } from '@/lib/drawing/edgeTypes';
import { outlineEdges } from '@/lib/drawing/geometry';

const BAND_STROKE_PX = 4;

export function PieceEdgeColors({ piece, worldOutline, types, zoom }: {
  piece: Piece;
  /** The piece's outline in board millimetres (y up). */
  worldOutline: Point[];
  types: EdgeType[];
  zoom: number;
}) {
  const painted = paintedSides(piece.edges, types);
  if (painted.length === 0) return null;
  const screen = worldOutline.map((p) => ({ x: p.x, y: -p.y }));
  const sides = outlineEdges(screen);
  return (
    <g pointerEvents="none" aria-hidden="true">
      {painted.map(({ index, color }) => {
        const side = sides[index];
        if (!side) return null; // a stale entry for a side that no longer exists
        const [a, b] = side;
        return (
          <path
            key={index}
            d={`M${a.x},${a.y} ${sidePath(a, b, arcHeightOf(piece.edges, index))}`}
            fill="none"
            stroke={color}
            strokeWidth={BAND_STROKE_PX / zoom}
            data-testid={`edge-color-${index}`}
          />
        );
      })}
    </g>
  );
}
