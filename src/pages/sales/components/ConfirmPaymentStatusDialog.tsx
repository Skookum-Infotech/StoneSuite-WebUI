import { createPortal } from 'react-dom';
import { Ban, Landmark, type LucideIcon } from 'lucide-react';
import { useModalDialog } from '@/hooks/useModalDialog';
import type { PaymentHeaderCode } from '@/lib/paymentForm';

interface ConfirmCopy {
  icon: LucideIcon;
  title: (paymentNumber: string) => string;
  body: string;
  confirm: string;
  pending: string;
  /** Tailwind classes for the icon disc and the confirm button. */
  iconDisc: string;
  iconColor: string;
  confirmBtn: string;
}

// Deposited and Void are final — no legal move leaves them — so the one-click
// header buttons ask first. Void is destructive-toned; Deposited is green.
const COPY: Record<PaymentHeaderCode, ConfirmCopy> = {
  DEPO: {
    icon: Landmark,
    title: (n) => `Mark ${n} as Deposited?`,
    body: 'A deposited payment is final: it cannot be moved to another status afterwards.',
    confirm: 'Mark Deposited',
    pending: 'Marking deposited…',
    iconDisc: 'bg-emerald-50',
    iconColor: 'text-emerald-600',
    confirmBtn: 'bg-emerald-600 hover:bg-emerald-700',
  },
  VOID: {
    icon: Ban,
    title: (n) => `Void ${n}?`,
    body: 'A voided payment is final: it can no longer be applied to invoices.',
    confirm: 'Void payment',
    pending: 'Voiding…',
    iconDisc: 'bg-destructive/10',
    iconColor: 'text-destructive',
    confirmBtn: 'bg-destructive hover:bg-destructive/90',
  },
};

// Mounted only while a confirmation is open, so useModalDialog's focus-in /
// restore-focus-on-unmount lines up with open and close. The page owns the
// mutation and closes this on settle; a failure shows under the page header.
export function ConfirmPaymentStatusDialog({ target, paymentNumber, pending, onConfirm, onCancel }: {
  target: PaymentHeaderCode;
  paymentNumber: string;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const panelRef = useModalDialog(onCancel);
  const copy = COPY[target];
  const Icon = copy.icon;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="payment-status-confirm-title"
      onClick={(e) => e.target === e.currentTarget && !pending && onCancel()}
    >
      <div ref={panelRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className={`flex size-9 flex-shrink-0 items-center justify-center rounded-full ${copy.iconDisc}`}>
            <Icon className={`size-4 ${copy.iconColor}`} aria-hidden="true" />
          </div>
          <div>
            <h3 id="payment-status-confirm-title" className="text-sm font-bold text-stone-900">
              {copy.title(paymentNumber || 'this payment')}
            </h3>
            <p className="mt-0.5 text-xs text-stone-500">This action cannot be undone.</p>
          </div>
        </div>

        <p className="mb-4 text-xs text-stone-600">{copy.body}</p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            aria-label="Cancel"
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={pending}
            aria-label={copy.confirm}
            className={`rounded-lg px-3 py-1.5 text-xs font-semibold text-white transition-all active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${copy.confirmBtn}`}
          >
            {pending ? copy.pending : copy.confirm}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
