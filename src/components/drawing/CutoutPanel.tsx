// The Cutout tab's side panel: the buttons that add an opening, and the
// openings already on the selected piece. "Only Cutout" opens the Cutout
// dialog to add one; clicking an opening here (or on the board) opens the same
// dialog to edit it. Inventory and Custom Item are placeholders for the next
// build.

import { useState } from 'react';
import { CUTOUT_TYPE_LABELS } from '@/lib/drawing/cutouts';
import { CutoutDialog } from './CutoutDialog';
import { useDrawingEditor } from './DrawingEditorContext';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
const BUTTON_CLASS = 'flex-1 rounded bg-brand px-2 py-1.5 text-xs font-medium text-ink-strong hover:bg-brand-hover disabled:opacity-50 disabled:hover:bg-brand';

export function CutoutPanel() {
  const { state, dispatch, editingCutoutId, editCutout, placing, cancelPlacing } = useDrawingEditor();
  const [dialogOpen, setDialogOpen] = useState(false);
  const area = state.present.areas.find((a) => a.id === state.activeAreaId);
  // The piece a clicked cutout is on, which is selected along with it.
  const piece = area?.pieces.find((p) => p.id === state.selectedPieceId);
  const editing = piece?.cutouts.find((c) => c.id === editingCutoutId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex gap-1.5 border-b border-stone-200 p-3">
        <button type="button" disabled title="Coming soon" className={BUTTON_CLASS}>Inventory</button>
        <button type="button" disabled title="Coming soon" className={BUTTON_CLASS}>Custom Item</button>
        <button type="button" disabled={!piece || placing !== null} onClick={() => setDialogOpen(true)} className={BUTTON_CLASS}>Only Cutout</button>
      </div>

      {placing && (
        <div role="status" className="flex items-center justify-between gap-2 border-b border-stone-200 bg-brand/20 px-3 py-2 text-xs text-ink-strong">
          <span>Click on the piece to place the cutout.</span>
          <button type="button" onClick={cancelPlacing} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}>
            Cancel
          </button>
        </div>
      )}

      <div className="modal-scrollbar flex-1 overflow-y-auto p-3">
        {!piece && <p className="mt-16 text-center type-helper">Select a piece to add cutouts to it.</p>}
        {piece && piece.cutouts.length === 0 && (
          <p className="mt-16 text-center type-helper">No cutouts in this part yet.</p>
        )}
        {piece && piece.cutouts.length > 0 && (
          <ul aria-label="Cutouts on this piece" className="flex flex-col gap-1.5">
            {piece.cutouts.map((cutout) => {
              const name = cutout.label || CUTOUT_TYPE_LABELS[cutout.type];
              return (
                <li key={cutout.id}>
                  <button
                    type="button"
                    aria-label={`Edit ${name}`}
                    aria-pressed={state.selectedCutoutId === cutout.id}
                    onClick={() => {
                      dispatch({ type: 'selectCutout', pieceId: piece.id, cutoutId: cutout.id });
                      editCutout(cutout.id);
                    }}
                    className="flex w-full items-center justify-between rounded border border-stone-200 px-2 py-1.5 text-left text-xs aria-pressed:border-brand-dark aria-pressed:bg-brand/20"
                  >
                    <span className="truncate">{name}</span>
                    <span className="ml-2 shrink-0 text-ink-muted">{CUTOUT_TYPE_LABELS[cutout.type]}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {dialogOpen && piece && <CutoutDialog piece={piece} onClose={() => setDialogOpen(false)} />}
      {piece && editing && <CutoutDialog piece={piece} cutout={editing} onClose={() => editCutout(null)} />}
    </div>
  );
}
