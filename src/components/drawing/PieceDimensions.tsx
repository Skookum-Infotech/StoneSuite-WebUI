// The auto-placed dimension lines (and edge marks) around one piece. Drawn
// after the shape so they sit on top of its fill. Each side carries the same
// letter the inspector's Sides list uses, so "B: 121.7"" on the drawing and
// "Side 2" in the panel name the same edge.

import { memo, useMemo } from 'react';
import type { Piece } from '@/types/drawing';
import { layoutDimension, layoutEdgeDimensions, type DimensionLineLayout } from '@/lib/drawing/dimensions';
import { DIMENSION_FONT_SIZE_PX, DIMENSION_OFFSET_PX, MIN_READABLE_TEXT_PX } from '@/lib/drawing/constants';
import { transformOutline } from '@/lib/drawing/geometry';
import { edgeLetter } from '@/lib/drawing/labels';
import { canvasTextScaleDivisor } from '@/lib/drawing/textScale';
import { DimensionLine } from './DimensionLine';
import { useDrawingEditor } from './DrawingEditorContext';
import { EdgeMarks } from './EdgeMarks';

/** A circle has no straight sides to dimension per-edge, so it gets three
 *  dimensions instead of layoutEdgeDimensions's one-per-edge: the bounding
 *  width across the top and across the bottom (matching a rect piece's own
 *  top/bottom side dimensions), and the radius itself, centre to rim. */
function layoutCircleDimensions(center: Piece['position'], radiusMm: number, offsetMm: number): DimensionLineLayout[] {
  const top = layoutDimension({ x: center.x - radiusMm, y: center.y + radiusMm }, { x: center.x + radiusMm, y: center.y + radiusMm }, offsetMm);
  const bottom = layoutDimension({ x: center.x + radiusMm, y: center.y - radiusMm }, { x: center.x - radiusMm, y: center.y - radiusMm }, offsetMm);
  const radius = layoutDimension(center, { x: center.x, y: center.y + radiusMm }, 0);
  return [
    { ...top, edgeIndex: 0 },
    { ...bottom, edgeIndex: 1 },
    { ...radius, edgeIndex: 2 },
  ];
}

export const PieceDimensions = memo(function PieceDimensions(
  { piece, displayUnit, fractionDenominator }: {
    piece: Piece; displayUnit: 'in' | 'mm'; fractionDenominator: 16 | 32;
  },
) {
  const { state } = useDrawingEditor();
  // The dimension line's stand-off shares DimensionLine's own divisor (keyed
  // off the same DIMENSION_FONT_SIZE_PX/MIN_READABLE_TEXT_PX), so the line
  // and the number sitting on it scale — and hit their floor — together.
  const offsetMm = DIMENSION_OFFSET_PX / canvasTextScaleDivisor(state.zoom, DIMENSION_FONT_SIZE_PX, MIN_READABLE_TEXT_PX);
  const layouts = useMemo(() => {
    // A circle is rotationally symmetric, so its dimensions stay axis-aligned
    // on its centre (piece.position) regardless of piece.rotationDeg.
    if (piece.shape === 'circle' && piece.radiusMm) return layoutCircleDimensions(piece.position, piece.radiusMm, offsetMm);
    return layoutEdgeDimensions(transformOutline(piece.outline, piece.position, piece.rotationDeg), offsetMm);
  }, [piece.shape, piece.radiusMm, piece.outline, piece.position, piece.rotationDeg, offsetMm]);
  return (
    <>
      <EdgeMarks piece={piece} />
      {layouts.map((layout) => (
        <DimensionLine
          key={layout.edgeIndex}
          layout={layout}
          displayUnit={displayUnit}
          fractionDenominator={fractionDenominator}
          letter={edgeLetter(layout.edgeIndex ?? 0)}
        />
      ))}
    </>
  );
});
