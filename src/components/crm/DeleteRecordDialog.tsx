import { useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';

type Props = {
  recordId: string;
  workflowKey: string;
  label: string;
  onDeleted: () => void;
  /**
   * When provided and `blocked` is true, deletion is disabled and `content`
   * replaces the reason field — used to force a prerequisite (e.g. revoking a
   * customer's portal access) before the record can be deleted. `content`
   * receives a `close` callback so an action inside it can dismiss the dialog.
   */
  guard?: { blocked: boolean; content: (close: () => void) => ReactNode };
};

export function DeleteRecordDialog({ recordId, workflowKey, label, onDeleted, guard }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const blocked = guard?.blocked ?? false;

  const del = useMutation({
    mutationFn: () => crmService.deleteRecord(recordId, workflowKey, reason.trim()),
    onSuccess: () => {
      setOpen(false);
      setReason('');
      onDeleted();
    },
  });

  function handleClose() {
    setOpen(false);
    setReason('');
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Delete ${label}`}
        className="flex items-center gap-2.5 hover:bg-destructive/5 rounded-lg px-3 py-2 cursor-pointer text-xs text-destructive w-full transition-colors text-left"
      >
        <Trash2 className="size-4 shrink-0" />
        Delete record
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
          onClick={(e) => e.target === e.currentTarget && handleClose()}
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="size-4 text-destructive" />
              </div>
              <div>
                <h3 id="delete-dialog-title" className="text-sm font-bold text-stone-900">
                  {blocked ? 'Can’t delete this record yet' : 'Delete record?'}
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  {blocked ? 'Resolve the item below first.' : 'This action cannot be undone.'}
                </p>
              </div>
            </div>

            {guard?.blocked ? (
              guard.content(handleClose)
            ) : (
              <>
                <p className="text-xs text-stone-600 mb-4">
                  <span className="font-semibold">{label}</span> will be permanently deleted.
                </p>

                <div className="space-y-1.5">
                  <label htmlFor="delete-reason" className="text-xs font-semibold text-stone-500">
                    Reason for deletion <span className="text-destructive">*</span>
                  </label>
                  <textarea
                    id="delete-reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Briefly explain why you're deleting this record…"
                    rows={3}
                    className="w-full rounded-lg border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-800 placeholder:text-stone-400 focus:border-destructive/30 focus:outline-none focus:ring-2 focus:ring-destructive/10 resize-none"
                  />
                </div>

                {del.error && (
                  <p className="mt-3 text-xs text-destructive">
                    {apiErrorMessage(del.error, 'Failed to delete record.')}
                  </p>
                )}
              </>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={handleClose}
                disabled={del.isPending}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                {blocked ? 'Close' : 'Cancel'}
              </button>
              {!blocked && (
                <button
                  type="button"
                  onClick={() => del.mutate()}
                  disabled={del.isPending || reason.trim().length === 0}
                  className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
                >
                  {del.isPending ? 'Deleting…' : 'Delete record'}
                </button>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
