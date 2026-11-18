import { useState, useCallback, useRef, useEffect, useId } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { textareaCls } from '@/components/crm/formUtils';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
// An approver's Reject for a Sales/Purchases record awaiting approval, always
// capturing a reason -- the generic sibling of CRM's RejectRecordDialog, for
// the relational modules whose services expose `reject(id, reason)`. A veto,
// not a vote: needs no quorum, only that the caller is a configured approver
// (or a Super Admin) -- the record's `canReject` says so, and the page only
// renders this while it is true. The server enforces it again (403).
//
// Split into a trigger + a conditionally-mounted content component, same as
// RejectRecordDialog: useModalDialog's focus-on-open effect fires once per
// mount, so the content (and its reason textarea) must mount fresh each time
// the dialog opens rather than living inside an always-mounted wrapper, or
// every keystroke would re-trigger the effect and steal focus.
export function RejectApprovalDialog<T>({ noun, run, onRejected, warning }: {
  /** Names the record in the dialog, e.g. "purchase order". */
  noun: string;
  /** The module service's reject(id, reason). */
  run: (reason: string) => Promise<T>;
  onRejected: (updated: T) => void;
  /** What rejecting does to this record, shown above the reason field. */
  warning?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Reject this ${noun}`}
        className={cn(buttonVariants({ variant: 'outline' }), 'flex shrink-0')}
      >
        <XCircle className="size-3.5" />
        Reject
      </button>

      {open && (
        <RejectDialogContent
          noun={noun}
          run={run}
          warning={warning}
          onClose={() => setOpen(false)}
          onRejected={(updated) => { setOpen(false); onRejected(updated); }}
        />
      )}
    </>
  );
}

function RejectDialogContent<T>({ noun, run, warning, onClose, onRejected }: {
  noun: string;
  run: (reason: string) => Promise<T>;
  warning?: string;
  onClose: () => void;
  onRejected: (updated: T) => void;
}) {
  const [reason, setReason] = useState('');
  const titleId = useId();
  const reasonId = useId();
  const errorId = useId();

  const reject = useMutation({
    mutationFn: () => run(reason.trim()),
    onSuccess: onRejected,
  });

  // isPending read via a ref, not a useCallback dependency -- see
  // RejectRecordDialog for why: keeps closeIfIdle's identity stable across a
  // submit so useModalDialog's mount effect doesn't re-fire and steal focus
  // mid-dialog, while still reading the live pending state on close attempts.
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
      aria-labelledby={titleId}
      onClick={(e) => e.target === e.currentTarget && closeIfIdle()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-4 text-danger-ink" />
          </div>
          <div>
            <h3 id={titleId} className="type-card-title">
              Reject this {noun}?
            </h3>
            <p className="mt-0.5 type-helper">A reason is required.</p>
          </div>
        </div>

        {warning && <p className="mb-3 text-xs text-ink">{warning}</p>}

        <label htmlFor={reasonId} className="type-field-label">
          Reason
        </label>
        <textarea
          id={reasonId}
          rows={3}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={`Why is this ${noun} being rejected…`}
          aria-label="Rejection reason"
          aria-describedby={reject.error ? errorId : undefined}
          className={`${textareaCls} mt-1.5 mb-4`}
        />

        {reject.error && (
          <p id={errorId} role="alert" className="mb-3 type-error">
            {apiErrorMessage(reject.error, `Failed to reject ${noun}.`)}
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
            {reject.isPending ? 'Rejecting…' : `Reject ${noun}`}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
