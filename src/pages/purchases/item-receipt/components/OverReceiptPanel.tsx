import { AlertTriangle, ShieldAlert, Loader2 } from 'lucide-react';
import type { OverReceiptLine } from '@/lib/itemReceiptErrors';

import { buttonVariants } from '@/components/ui/button';
// The two over-receipt views shared by every place a delivery can be refused
// for exceeding the ordered quantity: PostReceiptDialog (posting an existing
// Pending receipt) and OverReceiptDialog (the New Item Receipt page's
// save-and-post). Which view shows depends on whether the caller holds
// item_receipt:approve — an approver may accept the over-delivery with a
// reason; anyone else is told to escalate, with no retry offered. Renders
// content only; the caller supplies the dialog shell (its aria-labelledby
// should point at OVER_RECEIPT_TITLE_ID) and owns the reason text so it
// survives the caller remounting this panel.
export const OVER_RECEIPT_TITLE_ID = 'over-receipt-title';

export function OverReceiptPanel({ lines, canApprove, isPending, reason, actions }: {
  lines: OverReceiptLine[];
  canApprove: boolean;
  isPending: boolean;
  reason: { value: string; onChange: (value: string) => void };
  actions: { onConfirm: () => void; onClose: () => void };
}) {
  if (!canApprove) {
    return (
      <>
        <div role="alert" className="mb-4 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-4 text-danger-ink" />
          </div>
          <div>
            <h3 id={OVER_RECEIPT_TITLE_ID} className="type-card-title">This Exceeds the Ordered Quantity</h3>
            <p className="mt-0.5 type-helper">You don&apos;t have permission to accept an over-delivery.</p>
          </div>
        </div>
        <OverReceiptLinesList lines={lines} />
        <p className="mt-4 text-xs text-stone-600">
          Ask someone with the Item Receipt Approve permission to post this receipt, or reduce the received
          quantities to stay within the ordered amount.
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={actions.onClose}
            className={buttonVariants({ variant: 'outline' })}
          >
            Close
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <div role="alert" className="mb-4 flex items-center gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
          <ShieldAlert className="size-4 text-warning-ink" />
        </div>
        <div>
          <h3 id={OVER_RECEIPT_TITLE_ID} className="type-card-title">This Exceeds the Ordered Quantity</h3>
          <p className="mt-0.5 type-helper">Confirm the over-receipt to post anyway.</p>
        </div>
      </div>
      <OverReceiptLinesList lines={lines} />
      <label className="mt-4 block type-field-label" htmlFor="over-receipt-reason">
        Reason <span className="text-red-400">*</span>
      </label>
      <textarea
        id="over-receipt-reason"
        required
        rows={3}
        value={reason.value}
        onChange={(e) => reason.onChange(e.target.value)}
        placeholder="Why is this shipment larger than ordered?"
        aria-label="Over-receipt reason"
        className="mt-1.5 w-full resize-none rounded-[10px] border border-stone-300 px-3.5 py-2.5 text-xs text-stone-900 outline-none transition-all focus:border-brand focus:ring-2 focus:ring-brand/30"
      />
      <div className="mt-4 flex justify-end gap-2">
        <button
          type="button"
          onClick={actions.onClose}
          disabled={isPending}
          className={buttonVariants({ variant: 'outline' })}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={actions.onConfirm}
          disabled={isPending || !reason.value.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
        >
          {isPending && <Loader2 className="size-3 animate-spin" />}
          {isPending ? 'Posting…' : 'Confirm & Post'}
        </button>
      </div>
    </>
  );
}

function OverReceiptLinesList({ lines }: { lines: OverReceiptLine[] }) {
  return (
    <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-micro text-amber-800">
      {lines.map((l) => (
        <li key={l.lineNumber}>
          Line {l.lineNumber} — ordered {l.ordered}, already received {l.alreadyReceived}, receiving {l.receiving}
        </li>
      ))}
    </ul>
  );
}
