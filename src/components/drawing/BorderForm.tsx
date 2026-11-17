// The numbers for the Border tool, shown once a side has been clicked: each
// named by the letter(s) its side(s) will carry on the drawing once applied
// (E, F, G ...). Apply reshapes the side as one undo step.

import type { Piece } from '@/types/drawing';
import { outlinePolyline } from '@/lib/drawing/arcs';
import { applyBorder, borderFields, type BorderParams } from '@/lib/drawing/borders';
import { validatePiece } from '@/lib/drawing/validation';
import { useDrawingEditor } from './DrawingEditorContext';
import { MeasurementsForm } from './MeasurementsForm';

export function BorderForm({ piece, edgeIndex }: { piece: Piece; edgeIndex: number }) {
  const { state, dispatch, border } = useDrawingEditor();

  const apply = (params: BorderParams): string | null => {
    border.setParams(params);
    const result = applyBorder(piece, edgeIndex, border.style, params);
    if (!result.ok) return result.error;
    // Checked against the real curved outline, so an arch cannot swallow a cutout or fold over the piece.
    const issues = validatePiece({ ...piece, outline: outlinePolyline(result.outline, result.edges) });
    if (issues.length > 0) return issues[0];
    dispatch({
      type: 'updatePiece',
      areaId: state.activeAreaId,
      pieceId: piece.id,
      patch: {
        outline: result.outline,
        edges: result.edges,
        ...(result.outline === piece.outline ? {} : { shape: 'polygon' as const }),
      },
    });
    border.setTarget(null);
    return null;
  };

  return (
    <MeasurementsForm
      label="Border measurements"
      fields={borderFields(border.style, edgeIndex)}
      values={border.params}
      onPreview={border.setParams}
      onApply={apply}
    />
  );
}
