// The Material tab's side panel. Inventory (top left) opens the slabs this sales
// order can use; the count (top right) is the slabs that have pieces on them out of
// the slabs added. Below, one card per slab added, where pieces are laid on the
// stone to see how the slab would be used.

import { useState } from 'react';
import { Boxes, LayoutGrid } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { usedSlabIds } from '@/lib/drawing/slabs';
import { slabPlaceables } from '@/lib/drawing/slabPlaceables';
import { useAttachedProfileTypeList } from './AttachedProfileTypesContext';
import { useDrawingEditor } from './DrawingEditorContext';
import { useMaterialPicker } from './MaterialPickerContext';
import { SlabCard } from './SlabCard';
import { SlabInventoryDialog } from './SlabInventoryDialog';
import { SlabsRequiredBadge } from './SlabsRequiredBadge';
import { useNestAll } from './useNestAll';
import { useOrderSlabs } from './useOrderSlabs';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
export function MaterialPanel() {
  const { state } = useDrawingEditor();
  const { pickingSlab, stopPicking } = useMaterialPicker();
  const { onDrawing, isLoading, error } = useOrderSlabs(state.present.salesOrderId);
  const profileTypes = useAttachedProfileTypeList();
  const [dialogOpen, setDialogOpen] = useState(false);
  const { nestAll, unplacedCount } = useNestAll(onDrawing);

  const used = usedSlabIds(slabPlaceables(state.present.areas, profileTypes));
  const usedCount = onDrawing.filter((slab) => used.has(slab.id)).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between gap-2 border-b border-stone-200 p-3">
        <button
          type="button"
          onClick={() => setDialogOpen(true)}
          className={buttonVariants()}
        >
          <Boxes className="size-4" aria-hidden="true" /> Inventory
        </button>
        <span
          role="status"
          aria-label={`${usedCount} of ${onDrawing.length} slabs used`}
          title="Slabs with pieces on them, out of the slabs added"
          className="rounded bg-brand/20 px-2.5 py-1 text-ink-strong type-pill"
        >
          Slabs: {usedCount} / {onDrawing.length}
        </span>
      </div>

      <div className="flex items-center justify-between gap-2 border-b border-stone-200 px-3 py-2">
        <button
          type="button"
          aria-label="Nest all"
          title="Lay every piece that is not on a slab yet onto these slabs. Pieces already placed stay where they are."
          disabled={onDrawing.length === 0 || unplacedCount === 0}
          onClick={nestAll}
          className={buttonVariants({ variant: 'outline' })}
        >
          <LayoutGrid className="size-4" aria-hidden="true" /> Nest all
        </button>
        <SlabsRequiredBadge className="inline-flex items-center gap-1.5 rounded bg-brand/20 px-2.5 py-1 text-xs font-semibold text-ink-strong" />
      </div>

      {pickingSlab && (
        <div role="status" className="flex items-center justify-between gap-2 border-b border-stone-200 bg-brand/20 px-3 py-2 text-xs text-ink-strong">
          <span>Click a piece or a painted profile on the drawing to lay it on slab {pickingSlab.serial}.</span>
          <button type="button" onClick={stopPicking} className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'shrink-0')}>
            Done
          </button>
        </div>
      )}

      <div className="modal-scrollbar flex-1 space-y-3 overflow-y-auto p-3">
        {isLoading && <p role="status" className="mt-16 text-center type-helper">Loading slabs…</p>}
        {!isLoading && Boolean(error) && (
          <p role="alert" className="mt-16 text-center type-error">{apiErrorMessage(error, 'Could not load the slabs.')}</p>
        )}
        {!isLoading && !error && onDrawing.length === 0 && (
          <p className="mt-16 px-2 text-center type-helper">
            No slabs yet. Choose Inventory to add the slabs you want to cut this order from.
          </p>
        )}
        {onDrawing.map((slab) => <SlabCard key={slab.id} slab={slab} />)}
      </div>

      {dialogOpen && <SlabInventoryDialog onClose={() => setDialogOpen(false)} />}
    </div>
  );
}
