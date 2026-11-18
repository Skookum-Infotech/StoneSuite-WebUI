import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { Landmark } from 'lucide-react';
import { journalEntryService } from '@/services/journalEntryService';
import { apiErrorMessage } from '@/api/tenantClient';
import type { JournalEntry } from '@/types/journalEntry';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// Posting is the act that actually moves money: it creates a balanced ledger
// entry and updates both accounts' running balances (cashtransfer/store_post.go)
// — a distinct, deliberate step from approving, never automatic. A 409 here
// can mean the entry was already posted, or the accounting period is closed.
// Mirrors DeleteItemReceiptDialog's focus management.
export function PostJournalEntryDialog({ journalEntryId, onPosted }: {
  journalEntryId: string;
  onPosted: (updated: JournalEntry) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const post = useMutation({
    mutationFn: () => journalEntryService.post(journalEntryId),
    onSuccess: (updated) => {
      setOpen(false);
      onPosted(updated);
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
      if (e.key === 'Escape' && !post.isPending) close();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open, post.isPending]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={cn(buttonVariants(), 'w-full active:scale-95')}
      >
        <Landmark className="size-3.5" />
        Post Journal Entry
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-je-dialog-title"
          onClick={(e) => e.target === e.currentTarget && !post.isPending && close()}
        >
          <div ref={panelRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
                <Landmark className="size-4 text-accent-foreground" />
              </div>
              <div>
                <h3 id="post-je-dialog-title" className="type-card-title">Post This Journal Entry?</h3>
                <p className="mt-0.5 type-helper">This creates a real ledger entry and updates both accounts&apos; balances.</p>
              </div>
            </div>

            <p className="text-xs text-ink mb-5">
              Once posted this journal entry can no longer be edited. To correct a mistake, reverse it instead.
            </p>

            {post.error && (
              <p role="alert" className="mb-3 type-error">
                {apiErrorMessage(post.error, 'Failed to post journal entry.')}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={close}
                disabled={post.isPending}
                className={buttonVariants({ variant: 'outline' })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => post.mutate()}
                disabled={post.isPending}
                className={cn(buttonVariants(), 'active:scale-95')}
              >
                {post.isPending ? 'Posting…' : 'Post Journal Entry'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
