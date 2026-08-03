import { useState } from 'react';
import { createPortal } from 'react-dom';
import { PackagePlus, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryCountService } from '@/services/inventoryCountService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { UnitPicker } from '@/components/inventory/UnitPicker';
import { ReasonSelect } from '@/components/inventory/ReasonSelect';
import type { InventoryUnit } from '@/types/inventory';

// A unit found in the counted scope that the frozen snapshot did not list —
// usually a misfiled location, not found stone (spec §9), so it's flagged
// isUnexpected rather than folded into the normal counted-line flow.
export function AddUnexpectedDialog({ countId, warehouseId, onClose, onAdded }: {
  countId: string;
  warehouseId: string;
  onClose: () => void;
  onAdded: () => void;
}) {
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();
  const { lookups } = useInventoryLookups();
  const [unit, setUnit] = useState<InventoryUnit | null>(null);
  const [reasonId, setReasonId] = useState('');

  const { mutate: add, isPending, error } = useMutation({
    mutationFn: () => inventoryCountService.addUnexpected(countId, { inventoryUnitId: unit!.id, reasonId: reasonId ? Number(reasonId) : undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-count', countId] });
      onAdded();
      onClose();
    },
  });

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="add-unexpected-title" onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}>
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent"><PackagePlus className="size-4 text-accent-foreground" /></div>
            <h3 id="add-unexpected-title" className="text-sm font-bold text-stone-900">Add Unexpected Unit</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-stone-400 hover:bg-stone-100"><X className="size-4" /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-900">Unit</label>
            <UnitPicker warehouseId={warehouseId} value={unit} onChange={setUnit} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-900">Reason</label>
            <ReasonSelect reasons={lookups?.reasons ?? []} value={reasonId} onChange={setReasonId} required={false} />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{apiErrorMessage(error, 'Failed to add unit.')}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => add()} disabled={isPending || !unit} className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 active:scale-95 transition-all">
            {isPending ? 'Adding…' : 'Add Unit'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
