// Transient shapes drawn over the canvas while a gesture is in progress: the
// shift-drag selection rectangle and the polygon being drawn.

import type { Point } from '@/types/drawing';

export interface Marquee {
  from: Point;
  to: Point;
}

export function CanvasOverlays({ marquee, draftPoints }: { marquee: Marquee | null; draftPoints: Point[] }) {
  return (
    <>
      {marquee && (
        <rect
          x={Math.min(marquee.from.x, marquee.to.x)}
          y={-Math.max(marquee.from.y, marquee.to.y)}
          width={Math.abs(marquee.to.x - marquee.from.x)}
          height={Math.abs(marquee.to.y - marquee.from.y)}
          className="fill-brand/10 stroke-brand"
          strokeDasharray="4 4"
          aria-hidden="true"
        />
      )}
      {draftPoints.length > 0 && (
        <polyline
          points={draftPoints.map((p) => `${p.x},${-p.y}`).join(' ')}
          fill="none"
          className="stroke-brand"
          strokeDasharray="4 4"
          aria-hidden="true"
        />
      )}
    </>
  );
}
