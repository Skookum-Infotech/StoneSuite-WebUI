// The drawing's pieces as flat silhouettes inside the corner map. Memoised on
// the shapes alone: panning and zooming change the map's transform and view
// box, never these polygons, so a pan re-renders nothing in here no matter how
// many pieces the drawing has.

import { memo } from 'react';

export interface MapShape {
  id: string;
  /** SVG `points`, already in drawing coordinates with y flipped. */
  points: string;
}

function MiniMapPiecesBase({ shapes }: { shapes: MapShape[] }) {
  return (
    <g aria-hidden="true">
      {shapes.map((shape) => (
        <polygon
          key={shape.id}
          points={shape.points}
          className="fill-stone-300 stroke-stone-500"
          strokeWidth={1}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

export const MiniMapPieces = memo(MiniMapPiecesBase);
