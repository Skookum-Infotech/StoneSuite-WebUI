// Left-panel "Cutouts" library: one button per opening type. Adding places the
// opening, at its default size, at the middle of the selected piece, then
// selects it so its exact size and position can be set in the inspector.
// A cutout is real geometry — if the piece is too small to hold the default
// size, or the middle is already taken, it says so instead of adding it.

import { toast } from 'sonner';
import type { CutoutType } from '@/types/drawing';
import { CUTOUT_TYPES, CUTOUT_TYPE_LABELS, newCutout, validateCutouts } from '@/lib/drawing/cutouts';
import { bounds } from '@/lib/drawing/geometry';
import { useDrawingEditor } from './DrawingEditorContext';

export function CutoutLibrary() {
  const { state, dispatch } = useDrawingEditor();
  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  const piece = area?.pieces.find((p) => p.id === state.selectedPieceId);

  const add = (type: CutoutType) => {
    if (!piece) return;
    const b = bounds(piece.outline);
    const cutout = newCutout(crypto.randomUUID(), type, { x: (b.minX + b.maxX) / 2, y: (b.minY + b.maxY) / 2 });
    const issues = validateCutouts({ outline: piece.outline, cutouts: [...piece.cutouts, cutout] });
    if (issues.length > 0) {
      toast.error(`Can't add a ${CUTOUT_TYPE_LABELS[type].toLowerCase()} there: ${issues[issues.length - 1].message}`);
      return;
    }
    dispatch({ type: 'addCutout', areaId: state.activeAreaId, pieceId: piece.id, cutout });
  };

  return (
    <section aria-label="Cutouts" className="flex flex-col gap-1.5">
      <h3 className="text-2xs font-semibold uppercase tracking-wide text-stone-500">Cutouts</h3>
      {!piece && <p className="text-2xs text-stone-500">Select a piece to add a cutout to it.</p>}
      {CUTOUT_TYPES.map((type) => (
        <button
          key={type}
          type="button"
          disabled={!piece}
          onClick={() => add(type)}
          aria-label={`Add ${CUTOUT_TYPE_LABELS[type].toLowerCase()}`}
          className="rounded border border-stone-200 px-2 py-1 text-left text-xs disabled:opacity-40"
        >
          {CUTOUT_TYPE_LABELS[type]}
        </button>
      ))}
    </section>
  );
}
