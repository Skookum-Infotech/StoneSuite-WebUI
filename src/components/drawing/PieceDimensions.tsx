// The auto-placed dimension lines (and edge marks) around one piece. Drawn
// after the shape so they sit on top of its fill. Each side carries the same
// letter the inspector's Sides list uses, so "B: 121.7"" on the drawing and
// "Side 2" in the panel name the same edge.

import { memo, useMemo } from 'react';
import type { Piece } from '@/types/drawing';
import { layoutEdgeDimensions } from '@/lib/drawing/dimensions';
import { transformOutline } from '@/lib/drawing/geometry';
import { edgeLetter } from '@/lib/drawing/labels';
import { DimensionLine } from './DimensionLine';
import { EdgeMarks } from './EdgeMarks';

export const PieceDimensions = memo(function PieceDimensions(
  { piece, displayUnit, fractionDenominator }: {
    piece: Piece; displayUnit: 'in' | 'mm'; fractionDenominator: 16 | 32;
  },
) {
  const layouts = useMemo(
    () => layoutEdgeDimensions(transformOutline(piece.outline, piece.position, piece.rotationDeg)),
    [piece.outline, piece.position, piece.rotationDeg],
  );
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
