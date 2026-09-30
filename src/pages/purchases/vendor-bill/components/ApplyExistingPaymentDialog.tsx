import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { Spinner } from '@/components/tenant/ui';
import { vendorPaymentService } from '@/services/vendorPaymentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';

const MIN_UNAPPLIED = 0.01;
const SEARCH_LIMIT = 100;
const VOID_CODE = 'VOID';

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

// Applies an already-recorded vendor payment that still has an unapplied
// balance to this bill. The list is the vendor's non-void payments with
// unapplied money left; the search has no vendor-uuid filter, so it narrows by
// vendor name and confirms the vendor id client-side (as VendorBillPicker
// does). The server enforces the real cap and vendor match.
export function ApplyExistingPaymentDialog({ vendorBillId, vendor, balanceDue, onClose }: {
  vendorBillId: string;
  vendor: { id: string; name: string };
  balanceDue: number;
  onClose: () => void;
}) {
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
            <h3 id="apply-existing-payment-title" className="text-sm font-bold text-stone-900">Apply existing payment</h3>
            <p className="text-xs text-stone-400 mt-0.5">Balance due: {currency(balanceDue)}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-6 flex justify-center"><Spinner label="Loading payments…" /></div>
        ) : error ? (
          <p role="alert" className="py-4 text-xs text-destructive">{apiErrorMessage(error, 'Failed to load payments.')}</p>
        ) : payments.length === 0 ? (
          <p className="py-4 text-sm text-stone-400">{vendor.name} has no payments with an unapplied balance.</p>
        ) : (
          <div className="space-y-3">
            <div>
              <label htmlFor="apply-existing-payment" className={fieldLabelCls}>Payment</label>
              <select
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
              </select>
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
                <p role="alert" className="mt-1 text-2xs text-destructive">
                  Amount exceeds the available {currency(cap)}.
                </p>
              )}
            </div>
          </div>
        )}

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
            disabled={apply.isPending || !valid}
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
