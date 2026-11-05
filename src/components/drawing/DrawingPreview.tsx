// Read-only render of every area in a saved Drawing, for the Sales Order
// detail page's Drawing tab (build spec §5 Task 5) — no editing, no
// selection, no pointer/keyboard handlers. A separate, simpler renderer
// from the interactive editor's DrawingCanvas/PieceShape rather than a
// shared one: this view only ever shows a static snapshot.

import { bounds, toWorldPoint, transformOutline } from '@/lib/drawing/geometry';
import { cutoutOutline } from '@/lib/drawing/cutouts';
import type { Drawing, DrawingArea } from '@/types/drawing';

const PREVIEW_PADDING_MM = 200;
const PIECE_LABEL_FONT_SIZE = 48;

export function DrawingPreview({ drawing }: { drawing: Drawing }) {
  return (
    <div className="flex flex-col gap-4">
      {drawing.areas.map((area) => (
        <AreaPreview key={area.id} area={area} />
      ))}
    </div>
  );
}

function AreaPreview({ area }: { area: DrawingArea }) {
  if (area.pieces.length === 0) {
    return (
      <div>
        <h4 className="text-xs font-semibold text-stone-700">{area.name}</h4>
        <p className="text-2xs text-stone-500">No pieces in this area yet.</p>
      </div>
    );
  }

  const worldOutlines = area.pieces.map((p) => transformOutline(p.outline, p.position, p.rotationDeg));
  // World y points up; SVG y points down — flip once here, same convention
  // DrawingCanvas/PieceShape use, so the viewBox and every polygon agree.
  const screenOutlines = worldOutlines.map((outline) => outline.map((pt) => ({ x: pt.x, y: -pt.y })));
  const b = bounds(screenOutlines.flat());

  return (
    <div>
      <h4 className="text-xs font-semibold text-stone-700">{area.name}</h4>
      <svg
        aria-hidden="true"
        viewBox={`${b.minX - PREVIEW_PADDING_MM} ${b.minY - PREVIEW_PADDING_MM} ${b.maxX - b.minX + 2 * PREVIEW_PADDING_MM} ${b.maxY - b.minY + 2 * PREVIEW_PADDING_MM}`}
        className="h-64 w-full rounded border border-stone-200 bg-stone-50"
      >
        {area.pieces.map((piece, i) => {
          const outline = screenOutlines[i];
          const center = bounds(outline);
          return (
            <g key={piece.id}>
              <polygon
                points={outline.map((pt) => `${pt.x},${pt.y}`).join(' ')}
                className="fill-stone-100 stroke-stone-400"
                strokeWidth={2}
              />
              {piece.cutouts.map((cutout) => (
                <polygon
                  key={cutout.id}
                  points={cutoutOutline(cutout)
                    .map((pt) => toWorldPoint(pt, piece.position, piece.rotationDeg))
                    .map((pt) => `${pt.x},${-pt.y}`)
                    .join(' ')}
                  className="fill-white stroke-stone-500"
                  strokeWidth={1}
                />
              ))}
              <text
                x={(center.minX + center.maxX) / 2}
                y={(center.minY + center.maxY) / 2}
                fontSize={PIECE_LABEL_FONT_SIZE}
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-stone-800 select-none"
              >
                {piece.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
