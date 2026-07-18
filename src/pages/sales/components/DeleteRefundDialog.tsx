import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { refundService } from '@/services/refundService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';

// Mirrors DeletePaymentDialog. The 409 "has live applications" server message
// (backend AD-9: delete blocked while applications exist — unapply or void
// first) surfaces as-is via apiErrorMessage — no special-cased client copy.
export function DeleteRefundDialog({ refundId, label, onDeleted }: {
  refundId: string;
  label: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => refundService.deleteRefund(refundId),
    onSuccess: () => {
      setOpen(false);
      onDeleted();
    },
  });

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${label}`}
        className="flex items-center gap-2.5 hover:bg-destructive/5 rounded-lg px-3 py-2 cursor-pointer text-xs text-destructive w-full transition-colors text-left"
      >
        <Trash2 className="size-4 shrink-0" aria-hidden="true" />
        Delete refund
      </button>

      {open && (
        <DeleteRefundModal
          label={label}
          error={del.error}
          isPending={del.isPending}
          onConfirm={() => del.mutate()}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

// Split out so useModalDialog's focus/Escape/restore effect runs on mount of
// the *open* dialog rather than on mount of the trigger button.
function DeleteRefundModal({ label, error, isPending, onConfirm, onClose }: {
  label: string;
  error: Error | null;
  isPending: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const contentRef = useModalDialog(onClose);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-refund-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-4 text-destructive" aria-hidden="true" />
          </div>
          <div>
            <h3 id="delete-refund-dialog-title" className="text-sm font-bold text-stone-900">
              Delete refund?
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-xs text-stone-600 mb-4">
          <span className="font-semibold">{label}</span> will be permanently deleted.
        </p>

        {/* role="alert": a 409 here explains the delete was refused because
            live applications remain (AD-9) — an actionable next step, not a
            transient failure, so it must be announced. */}
        {error && (
          <p role="alert" className="mb-3 text-xs text-destructive">
            {apiErrorMessage(error, 'Failed to delete refund.')}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {isPending ? 'Deleting…' : 'Delete refund'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
