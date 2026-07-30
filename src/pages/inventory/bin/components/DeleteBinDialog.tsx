import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryBinService } from '@/services/inventoryBinService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import type { Bin } from '@/types/inventory';

export function DeleteBinDialog({ bin, onClose, onDeleted }: { bin: Bin; onClose: () => void; onDeleted: () => void }) {
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();

  const { mutate: del, isPending, error } = useMutation({
    mutationFn: () => inventoryBinService.deleteBin(bin.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-bins-tree'] });
      onDeleted();
      onClose();
    },
  });

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="delete-bin-title" onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}>
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10"><AlertTriangle className="size-4 text-destructive" /></div>
            <div>
              <h3 id="delete-bin-title" className="text-sm font-bold text-stone-900">Delete bin?</h3>
              <p className="text-xs text-stone-400 mt-0.5">This action cannot be undone.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-stone-400 hover:bg-stone-100"><X className="size-4" /></button>
        </div>
        <p className="text-xs text-stone-600 mb-4"><span className="font-semibold">{bin.path || bin.name}</span> will be permanently deleted.</p>
        {error && <p className="mb-3 text-xs text-destructive">{apiErrorMessage(error, 'Failed to delete bin.')}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isPending} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50">Cancel</button>
          <button type="button" onClick={() => del()} disabled={isPending} className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 active:scale-95 transition-all">
            {isPending ? 'Deleting…' : 'Delete Bin'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
