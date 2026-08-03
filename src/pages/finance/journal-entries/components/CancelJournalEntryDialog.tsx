import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { journalEntryService } from '@/services/journalEntryService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { JournalEntry } from '@/types/journalEntry';

// Cancel is legal from Draft/Approved only (cashtransfer/transitions.go) —
// the generic transition endpoint, terminal (CANC never moves anywhere
// else). Mirrors VoidReceiptDialog, trimmed: no reason field required
// server-side for Cancel.
export function CancelJournalEntryDialog({ journalEntryId, onCancelled }: {
  journalEntryId: string;
  onCancelled: (updated: JournalEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const cancel = useMutation({
    mutationFn: () => journalEntryService.transition(journalEntryId, 'CANC'),
    onSuccess: (updated) => {
      setOpen(false);
      onCancelled(updated);
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
      if (e.key === 'Escape' && !cancel.isPending) close();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, cancel.isPending]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Cancel journal entry"
        className="flex items-center gap-2.5 hover:bg-destructive/5 rounded-lg px-3 py-2 cursor-pointer text-xs text-destructive w-full transition-colors text-left"
      >
        <Ban className="size-4 shrink-0" />
        Cancel journal entry
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-je-dialog-title"
          onClick={(e) => e.target === e.currentTarget && !cancel.isPending && close()}
        >
          <div ref={panelRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <Ban className="size-4 text-destructive" />
              </div>
              <div>
                <h3 id="cancel-je-dialog-title" className="text-sm font-bold text-stone-900">Cancel this journal entry?</h3>
                <p className="text-xs text-stone-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-4">
              Nothing has posted to the ledger yet, so there is nothing to reverse — it will simply be marked cancelled.
            </p>

            {cancel.error && (
              <p role="alert" className="mb-3 text-xs text-destructive">
                {apiErrorMessage(cancel.error, 'Failed to cancel journal entry.')}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={cancel.isPending}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
                className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {cancel.isPending ? 'Cancelling…' : 'Cancel Journal Entry'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
