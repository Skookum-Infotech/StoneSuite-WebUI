// The figure's name ("A-1") as large bold text standing just outside the
// piece's top-left corner, like a title above it. Outside, so it never sits on
// the stone's outline, seams or cutouts and cannot disturb the figure's
// border or how it scales. Sized by the zoom like every other piece of text on
// the canvas. Not interactive: pointer events fall through.

import type { Point } from '@/types/drawing';
import { DIMENSION_OFFSET_PX, MIN_READABLE_TEXT_PX } from '@/lib/drawing/constants';
import { canvasTextScaleDivisor } from '@/lib/drawing/textScale';
import { useDrawingEditor } from './DrawingEditorContext';

const FONT_SIZE_PX = 20;
/** Space between the text's baseline and the piece's corner. */
const GAP_PX = 10;
/** With dimensions on, the top side's dimension line stands off the edge by
 *  DIMENSION_OFFSET_PX — the name goes just beyond it rather than between it
 *  and the piece. */
const DIMENSION_CLEARANCE_PX = DIMENSION_OFFSET_PX + 10;
const HALO_PX = 4;

/** The outline's top-left vertex on screen: the highest one, and the leftmost
 *  of those if several share the top (an axis-aligned rectangle has two). */
function topLeftVertex(worldOutline: Point[]): Point {
  const screen = worldOutline.map((p) => ({ x: p.x, y: -p.y }));
  const top = Math.min(...screen.map((p) => p.y));
  const onTop = screen.filter((p) => p.y - top < 1e-6);
  return { x: Math.min(...onTop.map((p) => p.x)), y: top };
}

export function PieceLabel({ label, worldOutline }: { label: string; worldOutline: Point[] }) {
  const { state, dimensionsOn } = useDrawingEditor();
  if (worldOutline.length === 0 || !label) return null;

  // See canvasTextScaleDivisor.
  const divisor = canvasTextScaleDivisor(state.zoom, FONT_SIZE_PX, MIN_READABLE_TEXT_PX);
  const px = (value: number) => value / divisor;
  const corner = topLeftVertex(worldOutline);

  return (
    <text
      aria-hidden="true"
      pointerEvents="none"
      x={corner.x}
      y={corner.y - px(dimensionsOn ? DIMENSION_CLEARANCE_PX : GAP_PX)}
      fontSize={px(FONT_SIZE_PX)}
      strokeWidth={px(HALO_PX)}
      strokeLinejoin="round"
      paintOrder="stroke"
      className="fill-stone-900 stroke-white font-bold select-none"
    >
      {label}
    </text>
  );
}
