import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';

type Props = {
  recordId: string;
  workflowKey: string;
  label: string;
  onDeleted: () => void;
};

export function DeleteRecordDialog({ recordId, workflowKey, label, onDeleted }: Props) {
  const [open, setOpen] = useState(false);

  const del = useMutation({
    mutationFn: () => crmService.deleteRecord(recordId, workflowKey),
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
        className="rounded py-1.5 transition bg-red-500 hover:bg-red-800 text-white shadow-sm"
      >
        <span>
        Delete
        </span>

      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-dialog-title"
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-red-100">
                <AlertTriangle className="size-4 text-red-600" />
              </div>
              <h3 id="delete-dialog-title" className="text-sm font-bold text-stone-900">
                Delete record?
              </h3>
            </div>

            <p className="text-xs text-stone-600">
              <span className="font-semibold">{label}</span> will be permanently deleted. This
              action cannot be undone.
            </p>

            {del.error && (
              <p className="mt-3 text-xs text-red-600">
                {apiErrorMessage(del.error, 'Failed to delete record.')}
              </p>
            )}

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={del.isPending}
                className="rounded border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => del.mutate()}
                disabled={del.isPending}
                className="rounded bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {del.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
