import { createPortal } from 'react-dom';
import { TriangleAlert } from 'lucide-react';
import { useModalDialog } from '@/hooks/useModalDialog';

// Shown when someone cancels the credit memo that was prefilled from a payment.
// The payment was saved before this form opened, so leaving does not undo it:
// its excess simply stays unapplied, with no credit memo drawn from it.
export function LeaveCreditMemoDialog({ paymentNumber, amount, onStay, onLeave }: {
  /** The payment's number, when it has one. */
  paymentNumber?: string;
  /** The excess still unapplied on the payment, already formatted as money. */
  amount: string;
  onStay: () => void;
  onLeave: () => void;
}) {
  // Escape means "stay" — never an accidental way out of the form.
  const contentRef = useModalDialog(onStay);
  const paymentLabel = paymentNumber ? `Payment ${paymentNumber}` : 'The payment';

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leave-credit-memo-title"
      aria-describedby="leave-credit-memo-description"
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/10">
            <TriangleAlert className="size-4 text-warning" aria-hidden="true" />
          </div>
          <h3 id="leave-credit-memo-title" className="text-sm font-bold text-stone-900">
            Leave without creating the credit memo?
          </h3>
        </div>

        <div id="leave-credit-memo-description" className="space-y-3 text-xs text-stone-600">
          <p>
            {paymentLabel} is already saved. The extra {amount} is still unapplied on it, and no credit memo has been created.
          </p>
          <p>
            You can create it later: open the payment and choose Create credit memo.
          </p>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onStay}
            aria-label="Stay and review the credit memo"
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-sm transition-all hover:bg-brand-hover active:scale-95"
          >
            Stay and review
          </button>
          <button
            type="button"
            onClick={onLeave}
            aria-label="Leave without creating a credit memo"
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            Leave without creating
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
