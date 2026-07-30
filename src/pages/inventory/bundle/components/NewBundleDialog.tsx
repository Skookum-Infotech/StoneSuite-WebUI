import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Boxes, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { inventoryBundleService } from '@/services/inventoryBundleService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect';
import { toNumericWarehouseId } from '@/lib/inventoryWarehouse';

// Creates an empty (or pre-seeded) open bundle. The first member added fixes
// its item — nothing is asked here (spec §6).
export function NewBundleDialog({ onClose }: { onClose: () => void }) {
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { lookups } = useInventoryLookups();

  const [code, setCode] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [blockId, setBlockId] = useState('');
  const [lot, setLot] = useState('');

  const { mutate: create, isPending, error } = useMutation({
    mutationFn: () => inventoryBundleService.createBundle({
      code: code.trim(),
      warehouseId: toNumericWarehouseId(lookups?.warehouses ?? [], warehouseId),
      blockId: blockId || undefined,
      lot: lot || undefined,
    }),
    onSuccess: (bundle) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-bundles'] });
      navigate(`/inventory/bundle/${bundle.id}`);
    },
  });

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="new-bundle-title" onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}>
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent"><Boxes className="size-4 text-accent-foreground" /></div>
            <h3 id="new-bundle-title" className="text-sm font-bold text-stone-900">New Bundle</h3>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-stone-400 hover:bg-stone-100"><X className="size-4" /></button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className={fieldLabelCls}>Code *</label>
            <input type="text" value={code} onChange={(e) => setCode(e.target.value)} placeholder="Band tag / pallet code" className={fieldCls} aria-label="Bundle code" required />
          </div>
          <div className="space-y-1.5">
            <label className={fieldLabelCls}>Warehouse *</label>
            <WarehouseSelect warehouses={lookups?.warehouses ?? []} value={warehouseId} onChange={setWarehouseId} required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className={fieldLabelCls}>Block ID</label>
              <input type="text" value={blockId} onChange={(e) => setBlockId(e.target.value)} className={fieldCls} aria-label="Block ID" />
            </div>
            <div className="space-y-1.5">
              <label className={fieldLabelCls}>Lot</label>
              <input type="text" value={lot} onChange={(e) => setLot(e.target.value)} className={fieldCls} aria-label="Lot" />
            </div>
          </div>
        </div>

        {error && <p className="mt-3 text-xs text-destructive">{apiErrorMessage(error, 'Failed to create bundle.')}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => create()} disabled={isPending || !code.trim() || !warehouseId} className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 active:scale-95 transition-all">
            {isPending ? 'Creating…' : 'Create Bundle'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
