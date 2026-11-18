// The Material tab's side panel. Inventory (top left) opens the slabs this sales
// order can use; the count (top right) is the slabs that have pieces on them out of
// the slabs added. Below, one card per slab added, where pieces are laid on the
// stone to see how the slab would be used.

import { useState } from 'react';
import { Boxes } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { usedSlabIds } from '@/lib/drawing/slabs';
import { useDrawingEditor } from './DrawingEditorContext';
import { useMaterialPicker } from './MaterialPickerContext';
import { SlabCard } from './SlabCard';
import { SlabInventoryDialog } from './SlabInventoryDialog';
import { useOrderSlabs } from './useOrderSlabs';

export function MaterialPanel() {
  const { state } = useDrawingEditor();
  const { pickingSlab, stopPicking } = useMaterialPicker();
  const { onDrawing, isLoading, error } = useOrderSlabs(state.present.salesOrderId);
  const [dialogOpen, setDialogOpen] = useState(false);

  const used = usedSlabIds(state.present.areas.flatMap((a) => a.pieces));
  const usedCount = onDrawing.filter((slab) => used.has(slab.id)).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 p-3">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover"
        >
          <Boxes className="size-4" aria-hidden="true" /> Inventory
        </button>
        <span
          role="status"
          aria-label={`${usedCount} of ${onDrawing.length} slabs used`}
          title="Slabs with pieces on them, out of the slabs added"
          className="rounded bg-brand/20 px-2.5 py-1 text-xs font-semibold text-stone-800"
        >
          Slabs: {usedCount} / {onDrawing.length}
        </span>
      </div>

      {pickingSlab && (
        <div role="status" className="flex items-center justify-between gap-2 border-b border-stone-200 bg-brand/20 px-3 py-2 text-xs text-stone-800">
          <span>Click a piece on the drawing to lay it on slab {pickingSlab.serial}.</span>
          <button type="button" onClick={stopPicking} className="shrink-0 rounded border border-stone-300 bg-white px-2 py-0.5 text-2xs font-medium">
            Done
          </button>
        </div>
      )}

      <div className="modal-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
        {isLoading && <p role="status" className="mt-16 text-center text-xs text-stone-500">Loading slabs…</p>}
        {!isLoading && Boolean(error) && (
          <p role="alert" className="mt-16 text-center text-xs text-destructive">{apiErrorMessage(error, 'Could not load the slabs.')}</p>
        )}
        {!isLoading && !error && onDrawing.length === 0 && (
          <p className="mt-16 px-2 text-center text-xs text-stone-500">
            No slabs yet. Choose Inventory to add the slabs you want to cut this order from.
          </p>
        )}
        {onDrawing.map((slab) => <SlabCard key={slab.id} slab={slab} />)}
      </div>

      {dialogOpen && <SlabInventoryDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
