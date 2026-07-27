import { useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, Trash2 } from 'lucide-react';
import { useMutation, type UseMutationResult } from '@tanstack/react-query';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { parseCoaError } from '@/lib/coaErrors';
import { useModalDialog } from '@/hooks/useModalDialog';
import { BlockingSlotsDialog } from './BlockingSlotsDialog';

// Mirrors DeleteVendorDialog's look, but — unlike it — wires up
// useModalDialog: every other dialog/drawer in this module traps focus and
// closes on Escape, and an irreversible delete confirmation is the last
// place to skip that. The caller must not render the trigger for an
// isSystem account — seeded accounts can be renamed, retyped and toggled but
// never deleted, and the store 409s rather than accepting the request; the
// UI hides the affordance instead of letting that happen.
export function DeleteAccountDialog({ accountId, label, onDeleted }: {
  accountId: string;
  label: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [blocked, setBlocked] = useState<{ message: string; slots: string[] } | null>(null);

  const del = useMutation({
    mutationFn: () => chartOfAccountsService.deleteAccount(accountId),
    onSuccess: () => {
      setOpen(false);
      onDeleted();
    },
    onError: (err) => {
      const info = parseCoaError(err, 'Failed to delete account.');
      if (info.kind === 'blockingSlots') {
        setOpen(false);
        setBlocked({ message: info.message, slots: info.blockingSlots ?? [] });
      }
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
        <Trash2 className="size-4 shrink-0" />
        Delete account
      </button>

      {/* Mounted only while open, so useModalDialog's focus-trap/Escape/focus-restore
          effects run for exactly the dialog's open lifetime, not this trigger's. */}
      {open && (
        <DeleteAccountDialogContent label={label} del={del} onClose={() => setOpen(false)} />
      )}

      {blocked && (
        <BlockingSlotsDialog message={blocked.message} slots={blocked.slots} onClose={() => setBlocked(null)} />
      )}
    </>
  );
}

function DeleteAccountDialogContent({ label, del, onClose }: {
  label: string;
  del: UseMutationResult<void, Error, void>;
  onClose: () => void;
}) {
  const contentRef = useModalDialog(onClose);
  const errorInfo = del.error ? parseCoaError(del.error, 'Failed to delete account.') : null;
  const showGenericError = errorInfo && errorInfo.kind !== 'blockingSlots';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="delete-account-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-4 text-destructive" />
          </div>
          <div>
            <h3 id="delete-account-dialog-title" className="text-sm font-bold text-stone-900">
              Delete account?
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">This action cannot be undone.</p>
          </div>
        </div>

        <p className="text-xs text-stone-600 mb-4">
          <span className="font-semibold">{label}</span> will be permanently deleted.
        </p>

        {showGenericError && (
          <p role="alert" className="mb-3 text-xs text-destructive">{errorInfo.message}</p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={del.isPending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => del.mutate()}
            disabled={del.isPending}
            className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {del.isPending ? 'Deleting…' : 'Delete account'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
