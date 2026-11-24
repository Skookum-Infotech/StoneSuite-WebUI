// Shown in the Border bar instead of the measurements when the clicked side
// already carries a border: a side takes one border at a time, so the only move
// is "Make standard" — the original straight side comes back and any border
// can be applied to it afterwards.

import { useState } from 'react';
import type { Piece } from '@/types/drawing';
import { outlinePolyline } from '@/lib/drawing/arcs';
import { borderGroup, borderOn, borderStyleDef, removeBorder } from '@/lib/drawing/borders';
import { edgeLetter } from '@/lib/drawing/labels';
import { validatePiece } from '@/lib/drawing/validation';
import { useDrawingEditor } from './DrawingEditorContext';

import { buttonVariants } from '@/components/ui/button';
export function BorderExisting({ piece, edgeIndex }: { piece: Piece; edgeIndex: number }) {
  const { state, dispatch, border } = useDrawingEditor();
  const [error, setError] = useState<string | null>(null);
  const style = borderOn(piece.edges, edgeIndex);
  if (!style) return null;

  const group = borderGroup(piece.edges, edgeIndex);
  const letters = group.length === 1
    ? `Side ${edgeLetter(group[0])}`
    : `Sides ${edgeLetter(group[0])}–${edgeLetter(group[group.length - 1])}`;

  const makeStandard = () => {
    const result = removeBorder(piece, edgeIndex);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Straightening can pull stone back in under a cutout, so it is checked like any other edit.
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
    border.setTarget(null);
  };

  return (
    <div role="group" aria-label="Existing border" className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <p className="max-w-xs text-xs text-stone-300">
        {letters} already {group.length === 1 ? 'has' : 'have'} a {borderStyleDef(style).label}. A side takes one border
        at a time — make it standard again to apply a different one.
      </p>
      <button
        type="button"
        autoFocus
        onClick={makeStandard}
        className={buttonVariants()}
      >
        Make standard
      </button>
      {error && <p role="alert" className="basis-full type-error">{error}</p>}
    </div>
  );
}
