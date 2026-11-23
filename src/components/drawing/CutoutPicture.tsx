// The picture inside a cutout on the board: its bowls, drains and drainboard
// lines (lib/drawing/cutoutShapes.ts), drawn in the piece's local coordinates
// at the cutout's own size. Purely decorative — the opening itself is the
// rectangle underneath — so clicks fall through to it. Line weight is divided
// by the zoom, like the rest of the board's annotations, to stay the same on
// screen at any scale.

import type { Cutout } from '@/types/drawing';
import { buildShapeDrawing } from '@/lib/drawing/cutoutShapes';
import { useDrawingEditor } from './DrawingEditorContext';

const STROKE_PX = 1.5;

export function CutoutPicture({ cutout }: { cutout: Cutout }) {
  const { state } = useDrawingEditor();
  const drawing = buildShapeDrawing(cutout);
  if (!drawing) return null;

  return (
    <g
      data-testid="cutout-picture"
      aria-hidden="true"
      pointerEvents="none"
      fill="none"
      strokeLinecap="round"
      strokeWidth={STROKE_PX / state.zoom}
      className="stroke-stone-800"
    >
      {drawing.paths.map((d, i) => <path key={i} d={d} />)}
      {drawing.lines.map((l, i) => <line key={i} {...l} />)}
      {drawing.circles.map((c, i) => <circle key={i} {...c} />)}
    </g>
  );
}
