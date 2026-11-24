// The Material tab's Inventory dialog. It looks at the sales order, finds the
// slab-tracked items on it (Granite, say), and lists the slabs of those items that
// are in stock. Add reserves a slab for this order and puts it on the panel.
// Hand-rolled useModalDialog + createPortal, like CutoutDialog.

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { isAwaitingInspection } from '@/lib/drawing/slabHolds';
import { cn } from '@/lib/utils';
import { SlabOptionsTable } from './SlabOptionsTable';
import { useDrawingEditor } from './DrawingEditorContext';
import { useOrderSlabs } from './useOrderSlabs';

import { buttonVariants } from '@/components/ui/button';
export function SlabInventoryDialog({ onClose }: { onClose: () => void }) {
  const contentRef = useModalDialog(onClose);
  const { state } = useDrawingEditor();
  const { items, isLoading, error, addSlab, addingId, mutationError } = useOrderSlabs(state.present.salesOrderId);
  const [chosenItemId, setChosenItemId] = useState<string | null>(null);

  const item = items.find((i) => i.itemId === chosenItemId) ?? items[0];

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="slab-inventory-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 flex max-h-[90dvh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-stone-200 px-4 py-3">
          <div>
            <h2 id="slab-inventory-title" className="type-card-title">Inventory</h2>
            <p className="type-helper">
              Slabs of the items on this sales order. Adding a slab reserves it for this order.
            </p>
          </div>
          <button type="button" aria-label="Close inventory dialog" onClick={onClose} className="text-ink-muted hover:text-ink-strong">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {items.length > 1 && (
          <div role="tablist" aria-label="Items on this order" className="flex gap-1 overflow-x-auto border-b border-stone-200 px-4 pt-2">
            {items.map((i) => (
              <button
                key={i.itemId}
                type="button"
                role="tab"
                aria-selected={i.itemId === item?.itemId}
                onClick={() => setChosenItemId(i.itemId)}
                className={cn(
                  'shrink-0 rounded-t border-b-2 px-3 py-1.5 text-xs font-medium',
                  i.itemId === item?.itemId ? 'border-brand-dark text-ink-strong' : 'border-transparent text-ink-muted hover:text-ink-strong',
                )}
              >
                {i.itemName} <span className="text-ink-muted">({i.units.length})</span>
              </button>
            ))}
          </div>
        )}

        <div className="modal-scrollbar min-h-0 flex-1 overflow-auto px-4 py-3">
          {isLoading && <p role="status" className="py-10 text-center type-helper">Loading slabs…</p>}
          {!isLoading && Boolean(error) && (
            <p role="alert" className="py-10 text-center type-error">{apiErrorMessage(error, 'Could not load the slabs.')}</p>
          )}
          {!isLoading && !error && items.length === 0 && (
            <p className="py-10 text-center type-helper">
              This sales order has no slab items yet. Add a stone line (Granite, Marble…) to the order, then come back.
            </p>
          )}
          {item && item.units.length === 0 && (
            <p className="py-10 text-center type-helper">No {item.itemName} slabs are in stock right now.</p>
          )}
          {item && item.units.length > 0 && item.units.every(isAwaitingInspection) && (
            <p role="note" className="mb-2 rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
              These {item.itemName} slabs are in stock but waiting for inspection. Accept them on their Inventory pages, then add them here.
            </p>
          )}
          {item && item.units.length > 0 && (
            <SlabOptionsTable units={item.units} addingId={addingId} onAdd={(slabId) => void addSlab(slabId).catch(() => undefined)} />
          )}
          {Boolean(mutationError) && (
            <p role="alert" className="mt-2 type-error">{apiErrorMessage(mutationError, 'Could not add the slab.')}</p>
          )}
        </div>

        <div className="flex justify-end border-t border-stone-200 px-4 py-3">
          <button type="button" onClick={onClose} className={buttonVariants({ variant: 'outline' })}>
            Done
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
