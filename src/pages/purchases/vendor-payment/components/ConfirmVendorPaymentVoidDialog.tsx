import { createPortal } from 'react-dom';
import { Ban } from 'lucide-react';
import { useModalDialog } from '@/hooks/useModalDialog';

// Void is terminal — no legal move leaves it — so the Danger Zone button asks
// first. Mounted only while open (focus-in / restore-focus lines up); the page
// owns the mutation and closes this on settle, failures show in its banner.
export function ConfirmVendorPaymentVoidDialog({ paymentNumber, pending, onConfirm, onCancel }: {
  paymentNumber: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useModalDialog(onCancel);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vp-void-confirm-title"
      onClick={(e) => e.target === e.currentTarget && !pending && onCancel()}
    >
      <div ref={panelRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <Ban className="size-4 text-destructive" aria-hidden="true" />
          </div>
          <div>
            <h3 id="vp-void-confirm-title" className="text-sm font-bold text-stone-900">Void {paymentNumber}?</h3>
            <p className="mt-0.5 text-xs text-stone-400">This action cannot be undone.</p>
          </div>
        </div>
        <p className="mb-4 text-xs text-stone-600">A voided payment is final: it can no longer be scheduled, sent or edited.</p>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            className="rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-destructive/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? 'Voiding…' : 'Void vendor payment'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
