// The Seams tool's bottom bar: how to draw one, and every seam already on the
// active area's pieces, each with a Delete. A seam is a cut line across a piece
// (the stone is cut there so a long top fits the slabs); a line drawn over empty
// canvas belongs to no piece and is dropped (see useAnnotationTool).

import { distance } from '@/lib/drawing/geometry';
import { formatLength } from '@/lib/drawing/units';
import { AnnotationRow } from './AnnotationRow';
import { useDrawingEditor } from './DrawingEditorContext';
import { ToolModeBar } from './ToolModeBar';

export function SeamModeBar() {
  const { tool, setTool, state, dispatch } = useDrawingEditor();
  if (tool !== 'line') return null;

  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  const { displayUnit, fractionDenominator } = state.present;
  const rows = (area?.pieces ?? []).flatMap((piece) => piece.seams.map((seam, index) => ({ piece, seam, index })));

  return (
    <ToolModeBar name="Seams tool" title="Seams" onClose={() => setTool('select')}>
      <p className="max-w-xs text-xs text-stone-300">
        Click two points across a piece, or drag from one to the other. Corners snap.
      </p>
      {rows.length > 0 && (
        <ul aria-label="Seams on this area" className="modal-scrollbar flex max-h-32 flex-col gap-1 overflow-y-auto">
          {rows.map(({ piece, seam, index }) => (
            <AnnotationRow
              key={`${piece.id}:${index}`}
              text={`${piece.label} · seam ${index + 1} · ${formatLength(distance(seam.from, seam.to), displayUnit, fractionDenominator)}`}
              deleteLabel={`Delete seam ${index + 1} on ${piece.label}`}
              onDelete={() => dispatch({
                type: 'setSeams', areaId: state.activeAreaId, pieceId: piece.id, seams: piece.seams.filter((_, i) => i !== index),
              })}
            />
          ))}
        </ul>
      )}
    </ToolModeBar>
  );
}
