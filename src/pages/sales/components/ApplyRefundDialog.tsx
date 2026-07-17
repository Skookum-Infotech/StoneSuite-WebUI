import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { DollarSign } from 'lucide-react';
import { refundService } from '@/services/refundService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { fieldLabelCls, fieldCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';
import { sourceRequestBody, SOURCE_KIND_LABELS, type RefundSourceKind } from '@/lib/refundForm';
import { RefundSourcePicker, type RefundSourceRef } from './RefundSourcePicker';
import type { Refund } from '@/types/refund';

const SOURCE_KINDS: RefundSourceKind[] = ['payment', 'credit_memo'];

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

// Draws part of a refund's unapplied balance from one source. The source-kind
// toggle is what makes this different from PaymentDetailPage's ApplyDialog:
// an application row is XOR-constrained to exactly one of a payment or a
// credit memo (spec AD-2), so the kind is picked first and the request body
// carries exactly one uuid. Composing a refund from both sources is two
// sequential applies, not one call (spec §11) — the tab stays open to the
// ledger afterwards so the second draw is one click away.
//
// Deliberately no client-side max on the amount: the true ceiling is
// min(refund.unapplied, source.unapplied - source.refunded_total), and
// refunded_total is not exposed on either source's JSON (see the note in
// RefundSourcePicker). Validating against the numbers we *do* have would
// wrongly accept an over-draw on a partly-refunded source while looking
// authoritative. The server rejects overshoot with a 400 explaining the real
// ceiling (AD-6, never clamped) and that message is surfaced verbatim.
export function ApplyRefundDialog({ refund, onClose, onApplied }: {
  refund: Refund;
  onClose: () => void;
  onApplied: () => void;
}) {
  const [kind, setKind] = useState<RefundSourceKind>('payment');
  const [source, setSource] = useState<RefundSourceRef | null>(null);
  const [amount, setAmount] = useState('');
  const contentRef = useModalDialog(onClose);

  const apply = useMutation({
    mutationFn: () =>
      refundService.apply(refund.id, sourceRequestBody(source!), parseFloat(amount)),
    onSuccess: onApplied,
  });

  const parsedAmount = parseFloat(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  // One live application row per (refund, source) pair — the backend's
  // uq_refund_app_live_pair partial unique index increments the existing row
  // rather than adding a second, so already-drawn sources of this kind drop
  // out of the picker to keep "add" and "increase" from looking alike.
  const excludeIds = refund.applications
    .map((a) => (kind === 'payment' ? a.paymentId : a.creditMemoId))
    .filter((id): id is string => Boolean(id));

  function switchKind(next: RefundSourceKind) {
    if (next === kind) return;
    setKind(next);
    setSource(null);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-refund-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <DollarSign className="size-4 text-emerald-600" aria-hidden="true" />
          </div>
          <div>
            <h3 id="apply-refund-dialog-title" className="text-sm font-bold text-stone-900">
              Draw from a source
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Unapplied balance: {currency(refund.unappliedAmount)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <span className={fieldLabelCls}>Source type</span>
            <div className="mt-1.5 flex gap-1.5" role="group" aria-label="Source type">
              {SOURCE_KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => switchKind(k)}
                  aria-pressed={kind === k}
                  className={cn(
                    'flex-1 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors',
                    kind === k
                      ? 'border-accent-foreground/20 bg-accent text-accent-foreground'
                      : 'border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-700',
                  )}
                >
                  {SOURCE_KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={fieldLabelCls}>{SOURCE_KIND_LABELS[kind]}</span>
            <div className="mt-1.5">
              <RefundSourcePicker
                customer={refund.customer}
                kind={kind}
                value={source}
                onChange={setSource}
                excludeIds={excludeIds}
              />
            </div>
          </div>

          <div>
            <label htmlFor="apply-refund-amount" className={fieldLabelCls}>Amount</label>
            <input
              id="apply-refund-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${fieldCls} mt-1.5`}
              aria-label="Application amount"
            />
          </div>
        </div>

        {/* role="alert": the server's 400 here carries the real ceiling this
            draw exceeded (AD-6), which is the whole point of the message —
            it must reach a screen-reader user who just pressed Apply. */}
        {apply.error && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {apiErrorMessage(apply.error, 'Failed to apply refund.')}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={apply.isPending}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => apply.mutate()}
            disabled={apply.isPending || !source || !validAmount}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
          >
            {apply.isPending ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
