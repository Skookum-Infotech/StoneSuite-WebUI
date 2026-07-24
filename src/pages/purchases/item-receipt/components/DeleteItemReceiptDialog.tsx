import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { itemReceiptService } from '@/services/itemReceiptService';
import { apiErrorMessage } from '@/api/tenantClient';

// Mirrors DeletePurchaseOrderDialog. The backend only accepts delete at
// PEND/VOID (itemreceipt/store_update.go SoftDelete); callers gate the
// trigger on IR_DELETABLE_STATUSES so a 409 here should never actually
// happen, but the error still surfaces if it does.
export function DeleteItemReceiptDialog({ itemReceiptId, label, onDeleted }: {
  itemReceiptId: string;
  label: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const del = useMutation({
    mutationFn: () => itemReceiptService.deleteItemReceipt(itemReceiptId),
    onSuccess: () => {
      setOpen(false);
      onDeleted();
    },
  });

  function close() {
    setOpen(false);
  }

  useEffect(() => {
    if (open) {
      panelRef.current?.focus();
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !del.isPending) close();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, del.isPending]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${label}`}
        className="flex items-center gap-2.5 hover:bg-destructive/5 rounded-lg px-3 py-2 cursor-pointer text-xs text-destructive w-full transition-colors text-left"
      >
        <Trash2 className="size-4 shrink-0" />
        Delete item receipt
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-ir-dialog-title"
          onClick={(e) => e.target === e.currentTarget && !del.isPending && close()}
        >
          <div ref={panelRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-4 text-destructive" />
              </div>
              <div>
                <h3 id="delete-ir-dialog-title" className="text-sm font-bold text-stone-900">
                  Delete item receipt?
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-4">
              <span className="font-semibold">{label}</span> will be permanently deleted.
            </p>

            {del.error && (
              <p className="mb-3 text-xs text-destructive">
                {apiErrorMessage(del.error, 'Failed to delete item receipt.')}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={del.isPending}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {del.isPending ? 'Deleting…' : 'Delete item receipt'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
