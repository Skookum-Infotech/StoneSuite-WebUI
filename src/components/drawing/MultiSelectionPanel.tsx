// Inspector content when more than one piece is selected: what is selected and
// the actions that apply to the whole group. Each is a single undo step.

import { useDrawingEditor } from './DrawingEditorContext';

export function MultiSelectionPanel() {
  const { state, dispatch, copySelection, duplicateSelection } = useDrawingEditor();
  const ids = state.selectedPieceIds;
  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  const labels = (area?.pieces ?? []).filter((p) => ids.includes(p.id)).map((p) => p.label);
  const button = 'rounded border border-stone-200 px-2 py-1';

  return (
    <div className="flex flex-col gap-2 text-xs">
      <p className="font-semibold text-stone-800">{ids.length} pieces selected</p>
      <p className="text-stone-500">{labels.join(', ')}</p>
      <p className="text-2xs text-stone-500">Drag any one to move them together. Click a single piece to edit its details.</p>
      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          aria-label="Rotate selected pieces"
          onClick={() => dispatch({ type: 'rotatePiece', areaId: state.activeAreaId, pieceId: ids[0], pieceIds: ids })}
          className={button}
        >
          Rotate 90°
        </button>
        <button type="button" aria-label="Duplicate selected pieces" onClick={duplicateSelection} className={button}>
          Duplicate
        </button>
        <button type="button" aria-label="Copy selected pieces" onClick={copySelection} className={button}>
          Copy
        </button>
        <button
          type="button"
          aria-label="Delete selected pieces"
          onClick={() => dispatch({ type: 'deletePieces', areaId: state.activeAreaId, pieceIds: ids })}
          className={`${button} text-destructive`}
        >
          Delete
        </button>
      </div>
    </div>
  );
}
