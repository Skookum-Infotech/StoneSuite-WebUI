import { Select } from '@/components/ui/select';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { Spinner } from '@/components/tenant/ui';
import { vendorPaymentService } from '@/services/vendorPaymentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { formatMoney } from '@/lib/formatMoney';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
const MIN_UNAPPLIED = 0.01;
const SEARCH_LIMIT = 100;
const VOID_CODE = 'VOID';

// Applies an already-recorded vendor payment that still has an unapplied
// balance to this bill. The list is the vendor's non-void payments with
// unapplied money left; the search has no vendor-uuid filter, so it narrows by
// vendor name and confirms the vendor id client-side (as VendorBillPicker
// does). The server enforces the real cap and vendor match.
export function ApplyExistingPaymentDialog({ vendorBillId, vendor, balanceDue, currencyCode, onClose }: {
  vendorBillId: string;
  vendor: { id: string; name: string };
  balanceDue: number;
  /** ISO currency code of the bill; falls back to the default currency. */
  currencyCode?: string;
  onClose: () => void;
}) {
  const currency = (n: number) => formatMoney(n, currencyCode);
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();
  const [paymentId, setPaymentId] = useState('');
  const [amount, setAmount] = useState('');

  const { data: payments = [], isLoading, error } = useQuery({
    queryKey: ['vendor-payments', 'unapplied', vendor.id],
    queryFn: async () => {
      const page = await vendorPaymentService.searchVendorPayments({
        search: vendor.name,
        filters: [{ field: 'unapplied_amount', op: 'gte', value: MIN_UNAPPLIED }],
        limit: SEARCH_LIMIT,
      });
      return page.records.filter((p) => p.vendor.id === vendor.id && p.statusCode !== VOID_CODE);
    },
  });

  const selected = payments.find((p) => p.id === paymentId);
  const cap = selected ? Math.min(selected.unappliedAmount, balanceDue) : balanceDue;
  const parsed = parseFloat(amount);
  const overCap = Number.isFinite(parsed) && parsed > cap;
  const valid = Boolean(selected) && Number.isFinite(parsed) && parsed > 0 && !overCap;

  const apply = useMutation({
    mutationFn: () => vendorPaymentService.apply(paymentId, vendorBillId, parsed),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendor-bill-payments', vendorBillId] });
      void queryClient.invalidateQueries({ queryKey: ['vendor-bill', vendorBillId] });
      void queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
      void queryClient.invalidateQueries({ queryKey: ['vendor-payments'] });
      onClose();
    },
  });

  function choose(id: string) {
    setPaymentId(id);
    const p = payments.find((row) => row.id === id);
    if (p) setAmount(String(Math.min(p.unappliedAmount, balanceDue)));
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-existing-payment-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <Wallet className="size-4 text-emerald-600" />
          </div>
          <div>
            <h3 id="apply-existing-payment-title" className="type-card-title">Apply Existing Payment</h3>
            <p className="mt-0.5 type-helper">Balance due: {currency(balanceDue)}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-6 flex justify-center"><Spinner label="Loading payments…" /></div>
        ) : error ? (
          <p role="alert" className="py-4 type-error">{apiErrorMessage(error, 'Failed to load payments.')}</p>
        ) : payments.length === 0 ? (
          <p className="py-4 text-sm text-stone-500">{vendor.name} has no payments with an unapplied balance.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="apply-existing-payment" className={fieldLabelCls}>Payment</label>
              <Select
                id="apply-existing-payment"
                value={paymentId}
                onChange={(e) => choose(e.target.value)}
                className={`${fieldCls} mt-1.5`}
              >
                <option value="">Select a payment…</option>
                {payments.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.vendorPaymentNumber || 'Payment'} — {currency(p.unappliedAmount)} unapplied
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label htmlFor="apply-existing-amount" className={fieldLabelCls}>Amount</label>
              <input
                id="apply-existing-amount"
                type="number"
                min="0.01"
                max={cap}
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={`${fieldCls} mt-1.5`}
              />
              {overCap && (
                <p role="alert" className="mt-1 type-error">
                  Amount exceeds the available {currency(cap)}.
                </p>
              )}
            </div>
          </div>
        )}

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
            disabled={apply.isPending || !valid}
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
