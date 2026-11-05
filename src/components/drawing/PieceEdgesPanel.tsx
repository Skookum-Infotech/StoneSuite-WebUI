// Inspector section listing every side of the selected piece with its exact
// length (editable) and the angle at its start corner. Setting a length moves
// the corners so the shape stays valid — see setEdgeLength — and a value that
// would make the piece uncuttable, or no longer fit its cutouts, is refused
// with the reason instead of being saved.

import type { Piece } from '@/types/drawing';
import { distance } from '@/lib/drawing/geometry';
import { edgeLetter } from '@/lib/drawing/labels';
import { pieceMetrics } from '@/lib/drawing/metrics';
import { validatePiece } from '@/lib/drawing/validation';
import { setEdgeLength } from '@/lib/drawing/vertexEdit';
import { useDrawingEditor } from './DrawingEditorContext';
import { EdgeSettingsFields } from './EdgeSettingsFields';
import { LengthInput } from './LengthInput';
import { PanelSection } from './PanelSection';

export function PieceEdgesPanel({ piece }: { piece: Piece }) {
  const { state, dispatch } = useDrawingEditor();
  const edges = pieceMetrics(piece).edges;

  const setLength = (index: number, mm: number): string | null => {
    const outline = setEdgeLength(piece.outline, index, mm);
    if (!outline) return 'This side has no length to extend.';
    const issues = validatePiece({ ...piece, outline });
    if (issues.length > 0) return issues[0];
    dispatch({ type: 'updatePiece', areaId: state.activeAreaId, pieceId: piece.id, patch: { outline } });
    return null;
  };

  return (
    <PanelSection title={`Sides (${edges.length})`} label="Sides" defaultOpen={false}>
      {edges.map((edge) => {
        const selected = state.selectedEdgeIndex === edge.index;
        return (
          <div key={edge.index} className={selected ? 'rounded bg-brand/10 p-1' : 'p-1'}>
            <button
              type="button"
              aria-label={`Select side ${edgeLetter(edge.index)}`}
              aria-pressed={selected}
              onClick={() => dispatch({ type: 'selectEdge', pieceId: piece.id, edgeIndex: edge.index })}
              className="mb-0.5 text-2xs text-stone-500 underline-offset-2 hover:underline"
            >
              Side {edgeLetter(edge.index)} · {Math.round(edge.startAngleDeg * 10) / 10}° corner
            </button>
            <LengthInput
              label={`Side ${edgeLetter(edge.index)} length`}
              valueMm={distance(piece.outline[edge.index], piece.outline[(edge.index + 1) % piece.outline.length])}
              onCommit={(mm) => setLength(edge.index, mm)}
            />
            {selected && <EdgeSettingsFields piece={piece} index={edge.index} />}
          </div>
        );
      })}
    </PanelSection>
  );
}
