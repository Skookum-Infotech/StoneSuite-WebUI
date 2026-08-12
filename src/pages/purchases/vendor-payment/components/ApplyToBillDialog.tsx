import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { vendorPaymentService } from '@/services/vendorPaymentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { VendorBillPicker, type VendorBillRef } from './VendorBillPicker';
import type { VendorPayment } from '@/types/vendorPayment';

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

// Applies part of a payment's unapplied balance to one vendor bill. Takes the
// whole `payment` rather than five separate scalars — it needs the id, vendor,
// unapplied balance and the already-applied bill ids, and the project caps a
// component at five props.
//
// The amount is capped server-side at min(payment.unappliedAmount,
// bill.balanceDue) and *rejected* rather than clamped when it exceeds that, so
// the input is bounded client-side too — but the server's answer is the one
// that counts, since the bill's balance can move between render and submit.
export function ApplyToBillDialog({ payment, onClose, onApplied }: {
  payment: VendorPayment;
  onClose: () => void;
  onApplied: (updated: VendorPayment) => void;
}) {
  const contentRef = useModalDialog(onClose);
  const [bill, setBill] = useState<VendorBillRef | null>(null);
  const [amount, setAmount] = useState('');

  const apply = useMutation({
    mutationFn: () => vendorPaymentService.apply(payment.id, bill!.id, parseFloat(amount)),
    onSuccess: onApplied,
  });

  const parsedAmount = parseFloat(amount);
  const cap = bill ? Math.min(payment.unappliedAmount, bill.balanceDue) : payment.unappliedAmount;
  const overCap = Number.isFinite(parsedAmount) && parsedAmount > cap;
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 && !overCap;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-vendor-payment-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <Wallet className="size-4 text-emerald-600" />
          </div>
          <div>
            <h3 id="apply-vendor-payment-dialog-title" className="text-sm font-bold text-stone-900">
              Apply to vendor bill
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Unapplied balance: {currency(payment.unappliedAmount)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className={fieldLabelCls}>Vendor Bill</label>
            <div className="mt-1.5">
              <VendorBillPicker
                vendor={payment.vendor}
                value={bill}
                onChange={setBill}
                excludeIds={payment.applications.map((a) => a.vendorBillId)}
              />
            </div>
          </div>
          <div>
            <label htmlFor="vp-apply-amount" className={fieldLabelCls}>Amount</label>
            <input
              id="vp-apply-amount"
              type="number"
              min="0.01"
              max={cap}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className={`${fieldCls} mt-1.5`}
              aria-label="Application amount"
            />
            {bill && (
              <p className="mt-1 text-2xs text-stone-400">
                At most {currency(cap)} — the smaller of this payment's unapplied balance and the bill's balance due.
              </p>
            )}
            {overCap && (
              <p role="alert" className="mt-1 text-2xs text-destructive">
                Amount exceeds the available balance of {currency(cap)}.
              </p>
            )}
          </div>
        </div>

        {apply.error && (
          <p role="alert" className="mt-3 text-xs text-destructive">
            {apiErrorMessage(apply.error, 'Failed to apply vendor payment.')}
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
            disabled={apply.isPending || !bill || !validAmount}
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
