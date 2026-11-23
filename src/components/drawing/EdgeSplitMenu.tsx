// The small popup that appears next to a side when it's clicked: just a
// "Split" button, which adds a corner at that side's midpoint (turning it
// into two sides). Deliberately a second step rather than an instant click
// on the side itself — see PieceHandles for why.

import type { Point } from '@/types/drawing';

const MENU_WIDTH_PX = 56;
const MENU_HEIGHT_PX = 24;
const MENU_RADIUS_PX = 4;
const FONT_SIZE_PX = 11;

export function EdgeSplitMenu(
  { at, zoom, letter, onSplit, onClose }: {
    /** Centre of the menu, already in this piece's screen (SVG) coordinates. */
    at: Point;
    zoom: number;
    letter: string;
    onSplit: () => void;
    onClose: () => void;
  },
) {
  // Divided by zoom so the menu stays a constant size on screen, the same
  // way every other handle here does (see PieceHandles' own `radius`).
  const px = (value: number) => value / zoom;
  const w = px(MENU_WIDTH_PX);
  const h = px(MENU_HEIGHT_PX);

  return (
    <g>
      <rect
        x={at.x - w / 2} y={at.y - h / 2} width={w} height={h} rx={px(MENU_RADIUS_PX)}
        className="fill-white stroke-stone-300"
        strokeWidth={px(1)}
      />
      <text
        x={at.x} y={at.y}
        role="button"
        tabIndex={0}
        aria-label={`Split side ${letter}`}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={px(FONT_SIZE_PX)}
        className="cursor-pointer fill-stone-700 font-medium outline-none hover:fill-brand-dark"
        onPointerDown={(e) => { e.stopPropagation(); onSplit(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSplit(); }
          // Escape backs out without splitting, same as the × — not treated
          // as "confirm", and stopped here so it doesn't also reach
          // DrawingCanvas's own Escape handler (which clears the selection).
          else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
        }}
      >
        Split
      </text>
      <text
        x={at.x + w / 2 - px(8)} y={at.y - h / 2 + px(8)}
        role="button"
        tabIndex={0}
        aria-label="Close split menu"
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={px(FONT_SIZE_PX)}
        className="cursor-pointer fill-stone-400 outline-none hover:fill-stone-700"
        onPointerDown={(e) => { e.stopPropagation(); onClose(); }}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
        }}
      >
        ×
      </text>
    </g>
  );
}
