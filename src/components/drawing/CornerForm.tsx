// The numbers for the Corner tool, shown once a corner has been clicked. The
// sizes are named by the sides of the drawing they are measured along (C, D ...)
// and a bump's height by the two sides it adds. Apply changes the corner as one
// undo step.

import type { Piece } from '@/types/drawing';
import { outlinePolyline } from '@/lib/drawing/arcs';
import { applyCorner, cornerFields, type CornerParams } from '@/lib/drawing/corners';
import { validatePiece } from '@/lib/drawing/validation';
import { useDrawingEditor } from './DrawingEditorContext';
import { MeasurementsForm } from './MeasurementsForm';

export function CornerForm({ piece, vertexIndex }: { piece: Piece; vertexIndex: number }) {
  const { state, dispatch, corner } = useDrawingEditor();

  const apply = (params: CornerParams): string | null => {
    corner.setParams(params);
    const result = applyCorner(piece, vertexIndex, corner.style, params);
    if (!result.ok) return result.error;
    // Checked against the real curved outline, so a bump cannot swallow a cutout or fold over the piece.
    const issues = validatePiece({ ...piece, outline: outlinePolyline(result.outline, result.edges) });
    if (issues.length > 0) return issues[0];
    dispatch({
      type: 'updatePiece',
      areaId: state.activeAreaId,
      pieceId: piece.id,
      patch: { outline: result.outline, edges: result.edges, shape: 'polygon' },
    });
    corner.setTarget(null);
    return null;
  };

  return (
    <MeasurementsForm
      label="Corner measurements"
      fields={cornerFields(corner.style, vertexIndex, piece.outline.length)}
      values={corner.params}
      onPreview={corner.setParams}
      onApply={apply}
    />
  );
}
