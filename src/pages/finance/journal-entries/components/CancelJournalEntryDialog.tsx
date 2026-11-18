import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { Ban } from 'lucide-react';
import { journalEntryService } from '@/services/journalEntryService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { JournalEntry } from '@/types/journalEntry';
import { DangerZoneAction } from '@/components/tenant/DangerZoneCard';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
      <DangerZoneAction
        ref={triggerRef}
        description="Cancel this journal entry."
        buttonLabel="Cancel journal entry"
        icon={Ban}
        onClick={() => setOpen(true)}
      />

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
                <Ban className="size-4 text-danger-ink" />
              </div>
              <div>
                <h3 id="cancel-je-dialog-title" className="type-card-title">Cancel This Journal Entry?</h3>
                <p className="mt-0.5 type-helper">This action cannot be undone.</p>
              </div>
            </div>

            <p className="text-xs text-ink mb-4">
              Nothing has posted to the ledger yet, so there is nothing to reverse — it will simply be marked cancelled.
            </p>

            {cancel.error && (
              <p role="alert" className="mb-3 type-error">
                {apiErrorMessage(cancel.error, 'Failed to cancel journal entry.')}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={cancel.isPending}
                className={buttonVariants({ variant: 'outline' })}
              >
                Keep it
              </button>
              <button
                type="button"
                onClick={() => cancel.mutate()}
                disabled={cancel.isPending}
                className={cn(buttonVariants({ variant: 'destructive' }), 'active:scale-95')}
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
