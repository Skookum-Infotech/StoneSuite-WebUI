// The auto-placed dimension lines (and edge marks) around one piece. Drawn
// after the shape so they sit on top of its fill. Memoised on the piece's
// geometry so dragging another piece doesn't recompute every outline's lines.

import { memo, useMemo } from 'react';
import type { Piece } from '@/types/drawing';
import { layoutEdgeDimensions } from '@/lib/drawing/dimensions';
import { transformOutline } from '@/lib/drawing/geometry';
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
      {layouts.map((layout, i) => (
        // Index key: edges have no stable id of their own, and this list is
        // rebuilt fresh from the piece whenever its geometry changes.
        <DimensionLine key={i} layout={layout} displayUnit={displayUnit} fractionDenominator={fractionDenominator} />
      ))}
    </>
  );
});
