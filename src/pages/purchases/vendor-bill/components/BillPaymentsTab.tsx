import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Wallet, Plus, Undo2 } from 'lucide-react';
import { Spinner } from '@/components/tenant/ui';
import { vendorBillService } from '@/services/vendorBillService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useUserPermissions } from '@/hooks/useUserPermissions';

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// The bill's AP reconciliation view — GET /vendor-bills/{id}/payments, which
// returns every live vendor payment application and refund touching this bill.
//
// Read-only on purpose: a vendor bill doesn't own a settlement ledger. Money
// reaches it only through the Vendor Payment module (`vendorpayment.Apply`),
// which recomputes this bill's amount_paid/balance_due inside the same
// transaction. So there's nothing to record or remove here — the action is
// "record a vendor payment", which is why the empty state links out to it
// rather than opening a dialog.
export function BillPaymentsTab({ vendorBillId, balanceDue }: {
  vendorBillId?: string;
  balanceDue: number;
}) {
  const navigate = useNavigate();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canCreatePayment = permissionsLoading || hasPermission('vendor_payment', 'create');

  const { data: ledger, isLoading, error } = useQuery({
    queryKey: ['vendor-bill-payments', vendorBillId],
    queryFn: () => vendorBillService.getPayments(vendorBillId!),
    enabled: Boolean(vendorBillId),
  });

  if (!vendorBillId) {
    return <p className="py-12 text-center text-sm text-stone-400">Payments will be available after saving the vendor bill.</p>;
  }

  const payments = ledger?.payments ?? [];
  const refunds = ledger?.refunds ?? [];

  return (
    <div className="space-y-4">
      {canCreatePayment && balanceDue > 0 && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => navigate('/purchases/vendor_payment/new')}
            aria-label="Record a vendor payment for this bill"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover transition-all"
          >
            <Plus className="size-3.5" />
            Record vendor payment
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="py-6 flex justify-center"><Spinner label="Loading payments…" /></div>
      ) : error ? (
        <p role="alert" className="py-6 text-center text-xs text-destructive/70 italic">
          {apiErrorMessage(error, 'Failed to load payments.')}
        </p>
      ) : (
        <>
          {payments.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Wallet className="size-6 text-stone-300" aria-hidden="true" />
              <p className="text-sm text-stone-400">No vendor payments applied to this bill yet.</p>
              <p className="text-xs text-stone-400">
                Bills are settled by applying a vendor payment — an approved bill with a balance due can be paid from the Vendor Payments module.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
              <table className="w-full text-left text-xs">
                <thead className="bg-stone-50 border-b border-stone-200">
                  <tr>
                    {['Payment #', 'Amount', 'Applied On'].map((h) => (
                      <th key={h} className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {payments.map((entry) => (
                    <tr key={`${entry.vendorPaymentId}-${entry.appliedAt}`} className="hover:bg-stone-50/50 transition-colors">
                      <td className="px-3 py-2.5 font-medium text-stone-800">
                        <button
                          type="button"
                          onClick={() => navigate(`/purchases/vendor_payment/${entry.vendorPaymentId}`)}
                          className="hover:text-accent-foreground transition-colors"
                        >
                          {entry.vendorPaymentNumber || '—'}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 font-semibold text-stone-900 tabular-nums whitespace-nowrap">{currency(entry.amount)}</td>
                      <td className="px-3 py-2.5 text-stone-400 tabular-nums whitespace-nowrap">{fmtDate(entry.appliedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {refunds.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Undo2 className="size-3.5 text-stone-400" aria-hidden="true" />
                <p className="text-2xs font-semibold uppercase tracking-wide text-stone-500">Refunds</p>
              </div>
              <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
                <table className="w-full text-left text-xs">
                  <thead className="bg-stone-50 border-b border-stone-200">
                    <tr>
                      {['Payment #', 'Amount', 'Reason', 'Refunded On'].map((h) => (
                        <th key={h} className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {refunds.map((entry) => (
                      <tr key={`${entry.vendorPaymentId}-${entry.refundedAt}`} className="hover:bg-stone-50/50 transition-colors">
                        <td className="px-3 py-2.5 font-medium text-stone-800">
                          <button
                            type="button"
                            onClick={() => navigate(`/purchases/vendor_payment/${entry.vendorPaymentId}`)}
                            className="hover:text-accent-foreground transition-colors"
                          >
                            {entry.vendorPaymentNumber || '—'}
                          </button>
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-stone-900 tabular-nums whitespace-nowrap">{currency(entry.amount)}</td>
                        <td className="px-3 py-2.5 text-stone-500 max-w-[220px] truncate">{entry.reason || '—'}</td>
                        <td className="px-3 py-2.5 text-stone-400 tabular-nums whitespace-nowrap">{fmtDate(entry.refundedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
