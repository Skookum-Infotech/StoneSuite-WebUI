// Shown in the Corner bar instead of the measurements when the clicked corner
// already carries a change: a corner takes one change at a time, so the only
// move is "Make standard" — the sharp corner comes back and any change can be
// applied to it afterwards.

import { useState } from 'react';
import type { Piece } from '@/types/drawing';
import { outlinePolyline } from '@/lib/drawing/arcs';
import { cornerChangeAt, cornerStyleDef, removeCorner } from '@/lib/drawing/corners';
import { validatePiece } from '@/lib/drawing/validation';
import { useDrawingEditor } from './DrawingEditorContext';

export function CornerExisting({ piece, vertexIndex }: { piece: Piece; vertexIndex: number }) {
  const { state, dispatch, corner } = useDrawingEditor();
  const [error, setError] = useState<string | null>(null);
  const change = cornerChangeAt(piece.edges, vertexIndex, piece.outline.length);
  if (!change) return null;

  const makeStandard = () => {
    const result = removeCorner(piece, vertexIndex);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Squaring the corner off can push stone back over a cutout, so it is checked like any other edit.
    const issues = validatePiece({ ...piece, outline: outlinePolyline(result.outline, result.edges) });
    if (issues.length > 0) {
      setError(issues[0]);
      return;
    }
    dispatch({
      type: 'updatePiece',
      areaId: state.activeAreaId,
      pieceId: piece.id,
      patch: { outline: result.outline, edges: result.edges },
    });
    corner.setTarget(null);
  };

  return (
    <div role="group" aria-label="Existing corner change" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="max-w-xs text-xs text-stone-300">
        This corner already has a {cornerStyleDef(change.style).label}. A corner takes one change at a time — make it
        standard again to apply a different one.
      </p>
      <button
        type="button"
        autoFocus
        onClick={makeStandard}
        className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-dark focus-visible:outline focus-visible:outline-2 focus-visible:outline-white"
      >
        Make standard
      </button>
      {error && <p role="alert" className="basis-full text-xs text-red-400">{error}</p>}
    </div>
  );
}
