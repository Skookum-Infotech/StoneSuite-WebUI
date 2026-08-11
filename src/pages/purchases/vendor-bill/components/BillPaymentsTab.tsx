import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Wallet } from 'lucide-react';
import { Spinner } from '@/components/tenant/ui';
import { vendorBillService } from '@/services/vendorBillService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { RecordBillPaymentDialog } from './RecordBillPaymentDialog';
import { RemoveBillPaymentDialog } from './RemoveBillPaymentDialog';

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// The bill's settlement ledger (AD-7) — GET /vendor-bills/{id}/payments.
// Lives on its own tab (rather than a card on Overview) so a bill with many
// installment payments doesn't crowd the header totals. Record Payment lives
// here (gated on VB_PAYABLE_STATUSES) alongside a per-row Remove (the
// "unapply") — both mutate the same rollup shown on Overview, so both
// invalidate ['vendor-bill', id] on success.
export function BillPaymentsTab({ vendorBillId, statusCode, balanceDue }: {
  vendorBillId?: string;
  statusCode: string;
  balanceDue: number;
}) {
  const queryClient = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canUpdate = permissionsLoading || hasPermission('vendor_bill', 'update');

  const { data: payments = [], isLoading, error } = useQuery({
    queryKey: ['vendor-bill-payments', vendorBillId],
    queryFn: () => vendorBillService.getPayments(vendorBillId!),
    enabled: Boolean(vendorBillId),
  });

  if (!vendorBillId) {
    return <p className="py-12 text-center text-sm text-stone-400">Payments will be available after saving the vendor bill.</p>;
  }

  function refresh() {
    queryClient.invalidateQueries({ queryKey: ['vendor-bill-payments', vendorBillId] });
  }

  return (
    <div className="space-y-3">
      {canUpdate && (
        <div className="flex justify-end">
          <RecordBillPaymentDialog
            vendorBillId={vendorBillId!}
            statusCode={statusCode}
            balanceDue={balanceDue}
            onRecorded={refresh}
          />
        </div>
      )}

      {isLoading ? (
        <div className="py-6 flex justify-center"><Spinner label="Loading payments…" /></div>
      ) : error ? (
        <p className="py-6 text-center text-xs text-destructive/70 italic">{apiErrorMessage(error, 'Failed to load payments.')}</p>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-12 text-center">
          <Wallet className="size-6 text-stone-300" aria-hidden="true" />
          <p className="text-sm text-stone-400">No payments recorded against this bill yet.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                {['Paid On', 'Amount', 'Method', 'Reference #', 'Memo', 'Recorded'].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">{h}</th>
                ))}
                {canUpdate && <th className="px-3 py-2.5" aria-hidden="true" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {payments.map((p) => (
                <tr key={p.id} className="hover:bg-stone-50/50 transition-colors">
                  <td className="px-3 py-2.5 text-stone-700 tabular-nums whitespace-nowrap">{fmtDate(p.paidAt)}</td>
                  <td className="px-3 py-2.5 font-semibold text-stone-900 tabular-nums whitespace-nowrap">{currency(p.amount)}</td>
                  <td className="px-3 py-2.5 text-stone-500">{p.method || '—'}</td>
                  <td className="px-3 py-2.5 text-stone-500 font-mono text-2xs">{p.referenceNumber || '—'}</td>
                  <td className="px-3 py-2.5 text-stone-500 max-w-[200px] truncate">{p.memo || '—'}</td>
                  <td className="px-3 py-2.5 text-stone-400 tabular-nums whitespace-nowrap">{fmtDate(p.createdAt)}</td>
                  {canUpdate && (
                    <td className="px-3 py-2.5 text-right">
                      <RemoveBillPaymentDialog
                        vendorBillId={vendorBillId}
                        paymentId={p.id}
                        label={`the ${currency(p.amount)} payment on ${fmtDate(p.paidAt)}`}
                        onRemoved={refresh}
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
