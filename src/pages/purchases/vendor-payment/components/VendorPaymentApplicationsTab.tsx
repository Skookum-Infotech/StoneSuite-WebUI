import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Unlink, Wallet } from 'lucide-react';
import { vendorPaymentService } from '@/services/vendorPaymentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { VP_BLOCKS_APPLY } from '@/lib/vendorPaymentForm';
import { ApplyToBillDialog } from './ApplyToBillDialog';
import type { VendorPayment } from '@/types/vendorPayment';

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// The payment's application ledger — which vendor bills this money settled and
// for how much. Apply/unapply both mutate the target bill's balance as well as
// this payment's rollup, so the caller re-seeds the payment from each mutation
// response (`onChanged`) rather than refetching one side in isolation.
//
// Both actions need `vendor_bill:update` on the target bill server-side on top
// of `vendor_payment:update` (AD-10) — a caller holding only the latter sees
// the buttons but gets a 403/404 back, surfaced inline.
export function VendorPaymentApplicationsTab({ payment, canEdit, onChanged }: {
  payment: VendorPayment;
  canEdit: boolean;
  onChanged: (updated: VendorPayment) => void;
}) {
  const navigate = useNavigate();
  const [applyOpen, setApplyOpen] = useState(false);

  const unapply = useMutation({
    mutationFn: (vendorBillId: string) => vendorPaymentService.unapply(payment.id, vendorBillId),
    onSuccess: onChanged,
  });

  const applyBlocked = VP_BLOCKS_APPLY.has(payment.statusCode);
  const noBalance = payment.unappliedAmount <= 0;

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setApplyOpen(true)}
            disabled={applyBlocked || noBalance}
            title={
              applyBlocked ? 'A voided payment cannot be applied.'
                : noBalance ? 'No unapplied balance remaining.'
                  : undefined
            }
            aria-label="Apply this payment to a vendor bill"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <Wallet className="size-3.5" />
            Apply to bill
          </button>
        </div>
      )}

      <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr className="divide-x divide-stone-200">
              {['Bill #', 'Amount', 'Applied On'].map((h) => (
                <th key={h} className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
              <th className="px-3 py-2.5" aria-hidden="true" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {payment.applications.map((app) => (
              <tr key={app.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                <td className="px-3 py-2.5 font-medium text-stone-800">
                  <button
                    type="button"
                    onClick={() => navigate(`/purchases/vendor_bill/${app.vendorBillId}`)}
                    className="hover:text-accent-foreground transition-colors"
                  >
                    {app.vendorBillNumber || '—'}
                  </button>
                </td>
                <td className="px-3 py-2.5 tabular-nums text-stone-700">{currency(app.amount)}</td>
                <td className="px-3 py-2.5 tabular-nums text-stone-400">{fmtDate(app.createdAt)}</td>
                <td className="px-3 py-2.5 text-right">
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => unapply.mutate(app.vendorBillId)}
                      disabled={unapply.isPending}
                      aria-label={`Unapply this payment from vendor bill ${app.vendorBillNumber}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-2xs font-medium text-stone-500 hover:bg-stone-50 disabled:opacity-40 transition-colors"
                    >
                      <Unlink className="size-3" />
                      Unapply
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {payment.applications.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-stone-400">
                  Not applied to any vendor bills yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {unapply.error && (
        <p role="alert" className="text-xs text-destructive">
          {apiErrorMessage(unapply.error, 'Failed to unapply vendor payment.')}
        </p>
      )}

      {applyOpen && (
        <ApplyToBillDialog
          payment={payment}
          onClose={() => setApplyOpen(false)}
          onApplied={(updated) => {
            setApplyOpen(false);
            onChanged(updated);
          }}
        />
      )}
    </div>
  );
}
