import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import { journalEntryService } from '@/services/journalEntryService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { JournalEntry } from '@/types/journalEntry';

// Approve moves a Draft journal entry to Approved (cashtransfer AD-5: a
// single-step approval, not a multi-approver chain) — the generic transition
// endpoint, gated by `cash_transfer:transition`. Mirrors DeleteItemReceiptDialog's
// focus management, trimmed to a plain confirm (no reason field needed).
export function ApproveJournalEntryDialog({ journalEntryId, onApproved }: {
  journalEntryId: string;
  onApproved: (updated: JournalEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const approve = useMutation({
    mutationFn: () => journalEntryService.transition(journalEntryId, 'APPR'),
    onSuccess: (updated) => {
      setOpen(false);
      onApproved(updated);
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
      if (e.key === 'Escape' && !approve.isPending) close();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, approve.isPending]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover transition-all shadow-sm active:scale-95"
      >
        <CheckCircle2 className="size-3.5" />
        Approve
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="approve-je-dialog-title"
          onClick={(e) => e.target === e.currentTarget && !approve.isPending && close()}
        >
          <div ref={panelRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
                <CheckCircle2 className="size-4 text-accent-foreground" />
              </div>
              <div>
                <h3 id="approve-je-dialog-title" className="text-sm font-bold text-stone-900">Approve this journal entry?</h3>
                <p className="text-xs text-stone-400 mt-0.5">It can then be posted to the ledger.</p>
              </div>
            </div>

            {approve.error && (
              <p role="alert" className="mb-3 text-xs text-destructive">
                {apiErrorMessage(approve.error, 'Failed to approve journal entry.')}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={approve.isPending}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => approve.mutate()}
                disabled={approve.isPending}
                className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {approve.isPending ? 'Approving…' : 'Approve'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
