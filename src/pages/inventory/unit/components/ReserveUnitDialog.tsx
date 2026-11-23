import { useState } from 'react';
import { createPortal } from 'react-dom';
import { UserCheck, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { CustomerPicker, type CustomerRef } from '@/pages/sales/components/CustomerPicker';
import type { InventoryUnit } from '@/types/inventory';

// Holds one available slab for a customer, picked from a searchable list of the
// customers who can be used on records. The slab goes to Reserved and nothing
// else may take it until the reservation is released.
export function ReserveUnitDialog({ unit, onClose, onReserved }: {
  unit: InventoryUnit;
  onClose: () => void;
  onReserved: (customerName: string) => void;
}) {
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();
  const [customer, setCustomer] = useState<CustomerRef | null>(null);
  const [note, setNote] = useState('');

  const { mutate: reserve, isPending, error } = useMutation({
    mutationFn: (picked: CustomerRef) =>
      inventoryUnitService.reserve(unit.id, { customerId: picked.id, note: note.trim() || undefined }),
    onSuccess: (_data, picked) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-unit', unit.id] });
      queryClient.invalidateQueries({ queryKey: ['inventory-unit-history', unit.id] });
      onReserved(picked.name);
      onClose();
    },
  });

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="reserve-unit-title" onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}>
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
              <UserCheck className="size-4 text-amber-700" />
            </div>
            <div>
              <h3 id="reserve-unit-title" className="text-sm font-bold text-stone-900">Reserve for customer</h3>
              <p className="text-xs text-stone-500 mt-0.5">{unit.serial} · {unit.area.toFixed(2)} {unit.areaUnitCode ?? ''}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-stone-400 hover:bg-stone-100"><X className="size-4" /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-900">Customer <span className="text-destructive">*</span></label>
            <CustomerPicker value={customer} onChange={setCustomer} label="customer to reserve for" />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="reserve-note" className="block text-xs font-semibold text-stone-900">Note</label>
            <input id="reserve-note" type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional" className="w-full h-10 px-3.5 text-xs border border-stone-300 rounded-[10px]" />
          </div>
          <p className="text-2xs text-stone-500">The slab stays in stock but no job, transfer or cut can use it until the reservation is released.</p>
        </div>

        {error && <p role="alert" className="mt-3 text-xs text-destructive">{apiErrorMessage(error, 'Failed to reserve unit.')}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => customer && reserve(customer)} disabled={isPending || !customer} className="rounded-lg bg-stone-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-stone-800 disabled:opacity-50 active:scale-95 transition-all">
            {isPending ? 'Reserving…' : 'Reserve'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
