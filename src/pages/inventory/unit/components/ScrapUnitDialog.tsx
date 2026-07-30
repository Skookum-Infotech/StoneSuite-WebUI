import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { ReasonSelect } from '@/components/inventory/ReasonSelect';
import type { InventoryUnit } from '@/types/inventory';

export function ScrapUnitDialog({ unit, onClose, onScrapped }: {
  unit: InventoryUnit;
  onClose: () => void;
  onScrapped: () => void;
}) {
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();
  const { lookups } = useInventoryLookups();
  const [reasonId, setReasonId] = useState('');
  const [note, setNote] = useState('');

  const { mutate: scrap, isPending, error } = useMutation({
    mutationFn: () => inventoryUnitService.scrap(unit.id, { reasonId: Number(reasonId), note: note || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-unit', unit.id] });
      onScrapped();
      onClose();
    },
  });

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="scrap-unit-title" onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}>
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="size-4 text-destructive" />
            </div>
            <div>
              <h3 id="scrap-unit-title" className="text-sm font-bold text-stone-900">Scrap Unit</h3>
              <p className="text-xs text-stone-400 mt-0.5">{unit.serial} · {unit.area.toFixed(2)} sq</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-stone-400 hover:bg-stone-100"><X className="size-4" /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-900">Reason <span className="text-destructive">*</span></label>
            <ReasonSelect reasons={lookups?.reasons ?? []} value={reasonId} onChange={setReasonId} />
          </div>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-900">Note</label>
            <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className="w-full h-10 px-3.5 text-xs border border-stone-300 rounded-[10px]" aria-label="Scrap note" />
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{apiErrorMessage(error, 'Failed to scrap unit.')}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => scrap()} disabled={isPending || !reasonId} className="rounded-lg bg-destructive px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 active:scale-95 transition-all">
            {isPending ? 'Scrapping…' : 'Scrap Unit'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
