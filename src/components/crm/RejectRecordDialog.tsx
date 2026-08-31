import { useState, useCallback, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, XCircle, Loader2 } from 'lucide-react';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { textareaCls } from '@/components/crm/formUtils';
import type { WorkflowRecord } from '@/types/tenant';

// Rejects a CRM record pending approval (POST /crm/{workflowKey}/records/{id}/reject),
// always capturing a reason — mirrors RejectExpenseDialog. A veto, not a
// vote: unlike Approve, this needs no quorum, only that the caller is a
// configured approver for the record's stage (or a Super Admin) — see
// record.approval.canReject. Rendered by the Detail page only while that's
// true, next to the ApprovalBanner rather than inside it.
//
// Split into a trigger + a conditionally-mounted content component — mirrors
// RejectExpenseDialog / RequisitionTransitionBar's TransitionConfirmDialog.
// useModalDialog's focus-on-open effect only fires once per mount, so the
// content (and its reason textarea) must mount fresh each time the dialog
// opens rather than living inside an always-mounted wrapper, or every
// keystroke would re-trigger the effect and steal focus.
export function RejectRecordDialog({ recordId, workflowKey, onRejected }: {
  recordId: string;
  workflowKey: string;
  onRejected: (updated: WorkflowRecord) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Reject this record"
        className="flex shrink-0 items-center justify-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50"
      >
        <XCircle className="size-3.5" />
        Reject
      </button>

      {open && (
        <RejectDialogContent
          recordId={recordId}
          workflowKey={workflowKey}
          onClose={() => setOpen(false)}
          onRejected={(updated) => { setOpen(false); onRejected(updated); }}
        />
      )}
    </>
  );
}

function RejectDialogContent({ recordId, workflowKey, onClose, onRejected }: {
  recordId: string;
  workflowKey: string;
  onClose: () => void;
  onRejected: (updated: WorkflowRecord) => void;
}) {
  const [reason, setReason] = useState('');

  const reject = useMutation({
    mutationFn: () => crmService.rejectRecord(recordId, reason.trim(), workflowKey),
    onSuccess: onRejected,
  });

  // isPending read via a ref, not a useCallback dependency — see
  // RejectExpenseDialog for why: keeps closeIfIdle's identity stable across a
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
      aria-labelledby="reject-crm-dialog-title"
      onClick={(e) => e.target === e.currentTarget && closeIfIdle()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-4 text-destructive" />
          </div>
          <div>
            <h3 id="reject-crm-dialog-title" className="text-sm font-bold text-stone-900">
              Reject this record?
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">A reason is required.</p>
          </div>
        </div>

        <label htmlFor="reject-crm-reason" className="text-2xs font-semibold uppercase tracking-wide text-stone-500">
          Reason
        </label>
        <textarea
          id="reject-crm-reason"
          rows={3}
          required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Why is this record being rejected…"
          aria-label="Rejection reason"
          aria-describedby={reject.error ? 'reject-crm-error' : undefined}
          className={`${textareaCls} mt-1.5 mb-4`}
        />

        {reject.error && (
          <p id="reject-crm-error" role="alert" className="mb-3 text-xs text-destructive">
            {apiErrorMessage(reject.error, 'Failed to reject record.')}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={closeIfIdle}
            disabled={reject.isPending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => reject.mutate()}
            disabled={reject.isPending || reason.trim() === ''}
            className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {reject.isPending ? <Loader2 className="mr-1 inline size-3 animate-spin" /> : null}
            {reject.isPending ? 'Rejecting…' : 'Reject record'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
