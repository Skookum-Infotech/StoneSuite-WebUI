import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Warehouse as WarehouseIcon, X } from 'lucide-react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { inventoryLookupService } from '@/services/inventoryLookupService';
import { lookupService } from '@/services/lookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import type { Warehouse, WarehouseInput } from '@/types/inventory';

export function WarehouseFormDialog({ warehouse, onClose, onSaved }: {
  warehouse?: Warehouse;
  onClose: () => void;
  onSaved: () => void;
}) {
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();
  const isEdit = Boolean(warehouse);

  const { data: crmLookups } = useQuery({ queryKey: ['crm-lookups'], queryFn: lookupService.getCrmLookups, staleTime: 10 * 60 * 1000 });

  const [name, setName] = useState(warehouse?.name ?? '');
  const [code, setCode] = useState(warehouse?.code ?? '');
  const [addrLine1, setAddrLine1] = useState(warehouse?.addrLine1 ?? '');
  const [addrLine2, setAddrLine2] = useState(warehouse?.addrLine2 ?? '');
  const [addrCity, setAddrCity] = useState(warehouse?.addrCity ?? '');
  const [addrState, setAddrState] = useState(warehouse?.addrStateId ? String(warehouse.addrStateId) : '');
  const [addrZip, setAddrZip] = useState(warehouse?.addrZip ?? '');
  const [isActive, setIsActive] = useState(warehouse?.isActive ?? true);

  const payload: WarehouseInput = {
    name: name.trim(), code: code.trim(), addrLine1, addrLine2, addrCity,
    addrStateId: addrState ? Number(addrState) : null, addrZip, isActive,
  };

  const { mutate: save, isPending, error } = useMutation({
    mutationFn: () => (isEdit ? inventoryLookupService.updateWarehouse(warehouse!.id, payload) : inventoryLookupService.createWarehouse(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-lookups'] });
      onSaved();
      onClose();
    },
  });

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4" role="dialog" aria-modal="true" aria-labelledby="warehouse-form-title" onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}>
      <div ref={contentRef} tabIndex={-1} className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl outline-none max-h-[85vh] overflow-y-auto modal-scrollbar">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent"><WarehouseIcon className="size-4 text-accent-foreground" /></div>
            <h3 id="warehouse-form-title" className="text-sm font-bold text-stone-900">{isEdit ? 'Edit Warehouse' : 'New Warehouse'}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-stone-400 hover:bg-stone-100"><X className="size-4" /></button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={fieldLabelCls}>Name *</label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} aria-label="Warehouse name" required />
            </div>
            <div className="space-y-1.5">
              <label className={fieldLabelCls}>Code *</label>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value)} className={fieldCls} aria-label="Warehouse code" required />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={fieldLabelCls}>Address Line 1</label>
            <input type="text" value={addrLine1} onChange={(e) => setAddrLine1(e.target.value)} className={fieldCls} aria-label="Address line 1" />
          </div>
          <div className="space-y-1.5">
            <label className={fieldLabelCls}>Address Line 2</label>
            <input type="text" value={addrLine2} onChange={(e) => setAddrLine2(e.target.value)} className={fieldCls} aria-label="Address line 2" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <label className={fieldLabelCls}>City</label>
              <input type="text" value={addrCity} onChange={(e) => setAddrCity(e.target.value)} className={fieldCls} aria-label="City" />
            </div>
            <div className="space-y-1.5 col-span-1">
              <label className={fieldLabelCls}>State</label>
              <select value={addrState} onChange={(e) => setAddrState(e.target.value)} className={fieldCls} aria-label="State">
                <option value="">—</option>
                {(crmLookups?.states ?? []).map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5 col-span-1">
              <label className={fieldLabelCls}>Zip</label>
              <input type="text" value={addrZip} onChange={(e) => setAddrZip(e.target.value)} className={fieldCls} aria-label="Zip" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="wh-active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4 rounded border-stone-300 text-brand focus:ring-brand/30" />
            <label htmlFor="wh-active" className="text-xs font-medium text-stone-700">Active</label>
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{apiErrorMessage(error, 'Failed to save warehouse.')}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => save()} disabled={isPending || !name.trim() || !code.trim()} className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 active:scale-95 transition-all">
            {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Warehouse'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
