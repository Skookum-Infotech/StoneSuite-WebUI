import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { Undo2 } from 'lucide-react';
import { journalEntryService } from '@/services/journalEntryService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { JournalEntry } from '@/types/journalEntry';

// Reverse creates a reversing ledger entry for a Posted journal entry,
// restoring both accounts' balances (cashtransfer/store_reverse.go) — only
// legal from Posted, and terminal (a reversed entry can never be reversed
// again). Mirrors VoidReceiptDialog, trimmed: no reason field required
// server-side for Reverse (unlike item receipt's void).
export function ReverseJournalEntryDialog({ journalEntryId, onReversed }: {
  journalEntryId: string;
  onReversed: (updated: JournalEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const reverse = useMutation({
    mutationFn: () => journalEntryService.reverse(journalEntryId),
    onSuccess: (updated) => {
      setOpen(false);
      onReversed(updated);
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
      if (e.key === 'Escape' && !reverse.isPending) close();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, reverse.isPending]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50 transition-all active:scale-95"
      >
        <Undo2 className="size-3.5" />
        Reverse
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reverse-je-dialog-title"
          onClick={(e) => e.target === e.currentTarget && !reverse.isPending && close()}
        >
          <div ref={panelRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
                <Undo2 className="size-4 text-amber-600" />
              </div>
              <div>
                <h3 id="reverse-je-dialog-title" className="text-sm font-bold text-stone-900">Reverse this journal entry?</h3>
                <p className="text-xs text-stone-400 mt-0.5">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-stone-600 mb-5">
              This posts a reversing ledger entry that restores both accounts&apos; balances to their pre-post values.
            </p>

            {reverse.error && (
              <p role="alert" className="mb-3 text-xs text-destructive">
                {apiErrorMessage(reverse.error, 'Failed to reverse journal entry.')}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={reverse.isPending}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => reverse.mutate()}
                disabled={reverse.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {reverse.isPending ? 'Reversing…' : 'Reverse Journal Entry'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
