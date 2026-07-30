import { useState } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryBinService } from '@/services/inventoryBinService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect';
import { BIN_TYPES } from '@/types/inventory';
import type { Bin, BinInput, Warehouse } from '@/types/inventory';

// Create/edit dialog for a bin. Depth is capped at 4 server-side; this only
// offers a parent bin picker (flattened, indented) rather than enforcing the
// cap client-side — the server's own message is the source of truth.
export function BinFormDialog({ bin, warehouses, allBins, defaultWarehouseId, defaultParentId, onClose, onSaved }: {
  bin?: Bin;
  warehouses: Warehouse[];
  allBins: Bin[];
  defaultWarehouseId?: string;
  defaultParentId?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();
  const isEdit = Boolean(bin);

  const [warehouseId, setWarehouseId] = useState(bin?.warehouseId ?? defaultWarehouseId ?? '');
  const [code, setCode] = useState(bin?.code ?? '');
  const [name, setName] = useState(bin?.name ?? '');
  const [type, setType] = useState(bin?.type ?? BIN_TYPES[0]);
  const [parentId, setParentId] = useState(bin?.parentId ?? defaultParentId ?? '');
  const [capacityUnits, setCapacityUnits] = useState(String(bin?.capacityUnits ?? 0));
  const [capacityArea, setCapacityArea] = useState(String(bin?.capacityArea ?? 0));
  const [isActive, setIsActive] = useState(bin?.isActive ?? true);
  const [notes, setNotes] = useState(bin?.notes ?? '');

  const payload: BinInput = {
    warehouseId, code: code.trim(), name: name.trim(), type,
    parentId: parentId || null,
    capacityUnits: Number(capacityUnits) || 0,
    capacityArea: Number(capacityArea) || 0,
    isActive, notes,
  };

  const { mutate: save, isPending, error } = useMutation({
    mutationFn: () => (isEdit ? inventoryBinService.updateBin(bin!.id, payload) : inventoryBinService.createBin(payload)),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-bins-tree'] });
      onSaved();
      onClose();
    },
  });

  const parentOptions = allBins.filter((b) => b.warehouseId === warehouseId && b.id !== bin?.id);

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4" role="dialog" aria-modal="true" aria-labelledby="bin-form-title" onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}>
      <div ref={contentRef} tabIndex={-1} className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl outline-none max-h-[85vh] overflow-y-auto modal-scrollbar">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent"><MapPin className="size-4 text-accent-foreground" /></div>
            <h3 id="bin-form-title" className="text-sm font-bold text-stone-900">{isEdit ? 'Edit Bin' : 'New Bin'}</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-stone-400 hover:bg-stone-100"><X className="size-4" /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={fieldLabelCls}>Warehouse *</label>
            <WarehouseSelect warehouses={warehouses} value={warehouseId} onChange={(v) => { setWarehouseId(v); setParentId(''); }} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={fieldLabelCls}>Code *</label>
              <input type="text" value={code} onChange={(e) => setCode(e.target.value)} className={fieldCls} aria-label="Bin code" required />
            </div>
            <div className="space-y-1.5">
              <label className={fieldLabelCls}>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value)} className={fieldCls} aria-label="Bin type">
                {BIN_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
          </div>
          <div className="space-y-1.5">
            <label className={fieldLabelCls}>Name *</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={fieldCls} aria-label="Bin name" required />
          </div>
          <div className="space-y-1.5">
            <label className={fieldLabelCls}>Parent Bin</label>
            <select value={parentId} onChange={(e) => setParentId(e.target.value)} className={fieldCls} aria-label="Parent bin">
              <option value="">— Top level —</option>
              {parentOptions.map((b) => <option key={b.id} value={b.id}>{b.path || b.name}</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={fieldLabelCls}>Capacity (units)</label>
              <input type="number" min={0} value={capacityUnits} onChange={(e) => setCapacityUnits(e.target.value)} className={fieldCls} aria-label="Capacity units" />
            </div>
            <div className="space-y-1.5">
              <label className={fieldLabelCls}>Capacity (area)</label>
              <input type="number" min={0} value={capacityArea} onChange={(e) => setCapacityArea(e.target.value)} className={fieldCls} aria-label="Capacity area" />
            </div>
          </div>
          <p className="text-2xs text-stone-400">Capacity is advisory only — it never blocks a move.</p>
          <div className="space-y-1.5">
            <label className={fieldLabelCls}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${fieldCls} h-auto resize-none`} aria-label="Notes" />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="bin-active" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="size-4 rounded border-stone-300 text-brand focus:ring-brand/30" />
            <label htmlFor="bin-active" className="text-xs font-medium text-stone-700">Active</label>
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{apiErrorMessage(error, 'Failed to save bin.')}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => save()} disabled={isPending || !warehouseId || !code.trim() || !name.trim()} className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 active:scale-95 transition-all">
            {isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Bin'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
