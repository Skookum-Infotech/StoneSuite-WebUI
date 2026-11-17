import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { expenseService } from '@/services/expenseService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { textareaCls } from '@/components/crm/formUtils';
import type { Expense } from '@/types/expense';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// Rejects a submitted expense claim (POST /expenses/{id}/reject), always
// capturing a reason — spec AD-5: rejection is a dedicated decision, never
// reachable through the generic transition bar, and never requires quorum
// the way Approve does (only gated on being a configured approver at all, if
// any are configured for SUBM). Rendered by the Detail page only while
// `statusCode === 'SUBM'` (canRejectExpense) and the caller has
// `expense:transition`.
//
// A caller who isn't a configured approver for SUBM gets 403 (ErrNotApprover),
// surfaced as the error message below — mirrors how ExpenseApprovalButton
// surfaces the same error for Approve.
//
// Split into a trigger + a conditionally-mounted content component — mirrors
// RequisitionTransitionBar's TransitionConfirmDialog. useModalDialog's
// focus-on-open effect only fires once per mount, so the content (and its
// reason textarea, whose typing re-renders only itself) must mount fresh
// each time the dialog opens rather than living inside an always-mounted
// wrapper, or every keystroke would re-trigger the effect and steal focus.
export function RejectExpenseDialog({ expenseId, onRejected }: {
  expenseId: string;
  onRejected: (updated: Expense) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Reject this expense claim"
        className={cn(buttonVariants({ variant: 'outline' }), 'w-full')}
      >
        <XCircle className="size-3" />
        Reject
      </button>

      {open && (
        <RejectDialogContent
          expenseId={expenseId}
          onClose={() => setOpen(false)}
          onRejected={(updated) => { setOpen(false); onRejected(updated); }}
        />
      )}
    </>
  );
}

function RejectDialogContent({ expenseId, onClose, onRejected }: {
  expenseId: string;
  onClose: () => void;
  onRejected: (updated: Expense) => void;
}) {
  const [reason, setReason] = useState('');

  const reject = useMutation({
    mutationFn: () => expenseService.reject(expenseId, reason.trim()),
    onSuccess: (updated) => {
      onRejected(updated);
      toast.success('Expense claim rejected.');
    },
  });

  // isPending read via a ref, not a useCallback dependency: depending on
  // reject.isPending directly would change closeIfIdle's identity the
  // instant a submit starts and again when it settles, re-triggering
  // useModalDialog's mount effect mid-dialog — its cleanup calls
  // opener.focus() (the trigger button behind the backdrop), so the dialog
  // would briefly lose focus to a hidden control and then regain it, right
  // as the user submits or sees an error. The ref keeps closeIfIdle stable
  // (identity only ever depends on onClose) while still reading the live
  // pending state when a close is actually attempted.
  const isPendingRef = useRef(reject.isPending);
  useEffect(() => {
    isPendingRef.current = reject.isPending;
  }, [reject.isPending]);
  const closeIfIdle = useCallback(() => {
    if (!isPendingRef.current) onClose();
  }, [onClose]);

  const contentRef = useModalDialog(closeIfIdle);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reject-exp-dialog-title"
      onClick={(e) => e.target === e.currentTarget && closeIfIdle()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-4 text-danger-ink" />
          </div>
          <div>
            <h3 id="reject-exp-dialog-title" className="type-card-title">
              Reject Expense Claim?
            </h3>
            <p className="mt-0.5 type-helper">A reason is required.</p>
          </div>
        </div>

        <label htmlFor="reject-exp-reason" className="type-field-label">
          Reason
        </label>
        <textarea
          id="reject-exp-reason"
          rows={3}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this claim being rejected…"
          aria-label="Rejection reason"
          aria-describedby={reject.error ? 'reject-exp-error' : undefined}
          className={`${textareaCls} mt-1.5 mb-4`}
        />

        {reject.error && (
          <p id="reject-exp-error" role="alert" className="mb-3 type-error">
            {apiErrorMessage(reject.error, 'Failed to reject expense claim.')}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeIfIdle}
            disabled={reject.isPending}
            className={buttonVariants({ variant: 'outline' })}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => reject.mutate()}
            disabled={reject.isPending || reason.trim() === ''}
            className={cn(buttonVariants({ variant: 'destructive' }), 'active:scale-95')}
          >
            {reject.isPending ? <Loader2 className="mr-1 inline size-3 animate-spin" /> : null}
            {reject.isPending ? 'Rejecting…' : 'Reject claim'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
