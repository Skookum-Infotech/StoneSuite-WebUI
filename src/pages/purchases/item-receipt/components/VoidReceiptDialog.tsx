import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Undo2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { itemReceiptService } from '@/services/itemReceiptService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { ItemReceipt } from '@/types/itemReceipt';

// Voiding reverses a posted receipt's stock/qty_received effects (or just
// closes out an unposted one) — terminal, and requires a non-empty reason
// (spec §3). Mirrors DeletePurchaseOrderDialog's focus management.
export function VoidReceiptDialog({ itemReceiptId, statusCode, onVoided }: {
  itemReceiptId: string;
  statusCode: string;
  onVoided: (updated: ItemReceipt) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const isPosted = statusCode === 'PART' || statusCode === 'RCVD';

  const voidMutation = useMutation({
    mutationFn: () => itemReceiptService.void(itemReceiptId, { voidReason: reason }),
    onSuccess: (updated) => {
      setOpen(false);
      setReason('');
      onVoided(updated);
    },
  });

  function close() {
    setOpen(false);
    setReason('');
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
      if (e.key === 'Escape' && !voidMutation.isPending) close();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, voidMutation.isPending]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Void item receipt"
        className="flex items-center gap-2.5 hover:bg-destructive/5 rounded-lg px-3 py-2 cursor-pointer text-xs text-destructive w-full transition-colors text-left"
      >
        <Undo2 className="size-4 shrink-0" />
        Void receipt
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-receipt-dialog-title"
          onClick={(e) => e.target === e.currentTarget && !voidMutation.isPending && close()}
        >
          <div ref={panelRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-4 text-destructive" />
              </div>
              <div>
                <h3 id="void-receipt-dialog-title" className="text-sm font-bold text-stone-900">
                  Void this item receipt?
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-4">
              {isPosted
                ? 'This reverses the stock this receipt posted and rolls the purchase order’s status back.'
                : 'This receipt has not been posted, so nothing needs to be reversed — it will simply be marked void.'}
            </p>

            <label className="block text-xs font-semibold text-stone-900 mb-1.5" htmlFor="void-reason">
              Void Reason <span className="text-red-400">*</span>
            </label>
            <textarea
              id="void-reason"
              required
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is this receipt being voided?"
              aria-label="Void reason"
              className="w-full resize-none rounded-[10px] border border-stone-300 px-3.5 py-2.5 text-xs text-stone-900 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/30"
            />

            {voidMutation.error && (
              <p role="alert" className="mt-3 text-xs text-destructive">
                {apiErrorMessage(voidMutation.error, 'Failed to void item receipt.')}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={voidMutation.isPending}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => voidMutation.mutate()}
                disabled={voidMutation.isPending || !reason.trim()}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {voidMutation.isPending ? 'Voiding…' : 'Void Receipt'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
