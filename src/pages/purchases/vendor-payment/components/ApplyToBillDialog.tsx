import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { vendorPaymentService } from '@/services/vendorPaymentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { VendorBillPicker, type VendorBillRef } from './VendorBillPicker';
import type { VendorPayment } from '@/types/vendorPayment';
import { formatMoney, currencyCodeFor } from '@/lib/formatMoney';
import { lookupService } from '@/services/lookupService';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
  const { data: lookups } = useQuery({ queryKey: ['crm-lookups'], queryFn: lookupService.getCrmLookups, staleTime: 10 * 60 * 1000 });
  const [bill, setBill] = useState<VendorBillRef | null>(null);
  // The bill's currency governs once picked; until then the payment's own.
  const currencyCode = currencyCodeFor(lookups, bill?.currencyId ?? payment.currencyId);
  const currency = (n: number) => formatMoney(n, currencyCode);
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
            <h3 id="apply-vendor-payment-dialog-title" className="type-card-title">
              Apply to Vendor Bill
            </h3>
            <p className="mt-0.5 type-helper">
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
                onChange={(b) => {
                  setBill(b);
                  if (b) setAmount(String(Math.min(payment.unappliedAmount, b.balanceDue)));
                }}
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
              <p className="mt-1 type-helper">
                At most {currency(cap)} — the smaller of this payment's unapplied balance and the bill's balance due.
              </p>
            )}
            {overCap && (
              <p role="alert" className="mt-1 type-error">
                Amount exceeds the available balance of {currency(cap)}.
              </p>
            )}
          </div>
        </div>

        {apply.error && (
          <p role="alert" className="mt-3 type-error">
            {apiErrorMessage(apply.error, 'Failed to apply vendor payment.')}
          </p>
        )}

        <div className="flex justify-end gap-2 mt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={apply.isPending}
            className={buttonVariants({ variant: 'outline' })}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => apply.mutate()}
            disabled={apply.isPending || !bill || !validAmount}
            className={cn(buttonVariants(), 'active:scale-95')}
          >
            {apply.isPending ? 'Applying…' : 'Apply'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
