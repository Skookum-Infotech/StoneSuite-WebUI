import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Ban } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { creditMemoService } from '@/services/creditMemoService';
import { apiErrorMessage } from '@/api/tenantClient';

// Void is a terminal, one-way transition (DRFT/APPV -> VOID) — unlike
// Invoice/Payment's plain status-dropdown, Credit Memo's spec calls it out
// as a standalone View-page action, so it gets its own confirm dialog,
// mirroring DeleteCreditMemoDialog's portal-modal pattern.
export function VoidCreditMemoDialog({ creditMemoId, label, onVoided }: {
  creditMemoId: string;
  label: string;
  onVoided: () => void;
}) {
  const [open, setOpen] = useState(false);

  const voidIt = useMutation({
    mutationFn: () => creditMemoService.transition(creditMemoId, 'VOID'),
    onSuccess: () => {
      setOpen(false);
      onVoided();
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Void ${label}`}
        className="flex items-center gap-2.5 hover:bg-destructive/5 rounded-lg px-3 py-2 cursor-pointer text-xs text-destructive w-full transition-colors text-left"
      >
        <Ban className="size-4 shrink-0" />
        Void credit memo
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="void-credit-memo-dialog-title"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-4 text-destructive" />
              </div>
              <div>
                <h3 id="void-credit-memo-dialog-title" className="text-sm font-bold text-stone-900">
                  Void credit memo?
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-4">
              <span className="font-semibold">{label}</span> will be voided and can no longer be edited or applied.
            </p>

            {voidIt.error && (
              <p className="mb-3 text-xs text-destructive">
                {apiErrorMessage(voidIt.error, 'Failed to void credit memo.')}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={voidIt.isPending}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => voidIt.mutate()}
                disabled={voidIt.isPending}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {voidIt.isPending ? 'Voiding…' : 'Void credit memo'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
