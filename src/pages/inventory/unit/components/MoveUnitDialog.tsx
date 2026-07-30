import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftRight, X } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { inventoryBinService } from '@/services/inventoryBinService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { BinPicker } from '@/components/inventory/BinPicker';
import type { InventoryUnit } from '@/types/inventory';

// Stock-neutral bin move — spec §3. The server refuses this for
// in_transit/consumed/scrapped/sealed-bundle units with its own explanatory
// message, surfaced verbatim rather than paraphrased.
//
// Bins are scoped to a warehouse by uuid; a Unit's warehouseId is the numeric
// SERIAL, and no endpoint maps one to the other (see WarehouseSelect's KNOWN
// GAP note). Until that gap closes, this loads the full bin tree unscoped —
// still correct, just not pre-filtered to the unit's own warehouse.
export function MoveUnitDialog({ unit, onClose, onMoved }: {
  unit: InventoryUnit;
  onClose: () => void;
  onMoved: () => void;
}) {
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();
  const [binId, setBinId] = useState(unit.binId ?? '');
  const [note, setNote] = useState('');

  const { data: bins = [] } = useQuery({
    queryKey: ['inventory-bins-tree-all'],
    queryFn: () => inventoryBinService.getTree(),
  });

  const { mutate: move, isPending, error } = useMutation({
    mutationFn: () => inventoryUnitService.moveBin(unit.id, { binId: binId || null, note: note || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-unit', unit.id] });
      onMoved();
      onClose();
    },
  });

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="move-unit-title" onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}>
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
              <ArrowLeftRight className="size-4 text-accent-foreground" />
            </div>
            <div>
              <h3 id="move-unit-title" className="text-sm font-bold text-stone-900">Move Bin</h3>
              <p className="text-xs text-stone-400 mt-0.5">{unit.serial}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-stone-400 hover:bg-stone-100"><X className="size-4" /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-900">Bin</label>
            <BinPicker bins={bins} value={binId} onChange={setBinId} label="Bin" allowEmpty emptyLabel="— Unbin —" />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-900">Note</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className="w-full h-10 px-3.5 text-xs border border-stone-300 rounded-[10px]" aria-label="Move note" />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{apiErrorMessage(error, 'Failed to move unit.')}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => move()} disabled={isPending} className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 active:scale-95 transition-all">
            {isPending ? 'Moving…' : 'Move'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
