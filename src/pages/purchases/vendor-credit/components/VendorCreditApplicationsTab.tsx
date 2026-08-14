import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Unlink, FilePlus } from 'lucide-react';
import { vendorCreditService } from '@/services/vendorCreditService';
import { apiErrorMessage } from '@/api/tenantClient';
import { applyBlockedReason } from '@/lib/vendorCreditForm';
import { ApplyToBillDialog } from './ApplyToBillDialog';
import type { VendorCredit } from '@/types/vendorCredit';

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// The credit's application ledger — which vendor bills this credit funded and
// for how much. Apply/reverse both mutate the target bill's balance as well
// as this credit's rollup, so the caller re-seeds the credit from each
// mutation response (`onChanged`) rather than refetching one side in
// isolation. Mirrors VendorPaymentApplicationsTab.
//
// Both actions need `vendor_bill:update` on the target bill server-side on
// top of `vendor_credit:update` (backend §6) — a caller holding only the
// latter sees the buttons but gets a 403/404 back, surfaced inline.
export function VendorCreditApplicationsTab({ credit, canEdit, onChanged }: {
  credit: VendorCredit;
  canEdit: boolean;
  onChanged: (updated: VendorCredit) => void;
}) {
  const navigate = useNavigate();
  const [applyOpen, setApplyOpen] = useState(false);

  const reverse = useMutation({
    mutationFn: (vendorBillId: string) => vendorCreditService.reverse(credit.id, vendorBillId),
    onSuccess: onChanged,
  });

  const blockedReason = applyBlockedReason(credit.statusCode, credit.unappliedAmount);

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setApplyOpen(true)}
            disabled={Boolean(blockedReason)}
            title={blockedReason ?? undefined}
            aria-label="Apply this vendor credit to a vendor bill"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <FilePlus className="size-3.5" />
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
            {credit.applications.map((app) => (
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
                      onClick={() => reverse.mutate(app.vendorBillId)}
                      disabled={reverse.isPending}
                      aria-label={`Reverse this credit's application to vendor bill ${app.vendorBillNumber}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-2xs font-medium text-stone-500 hover:bg-stone-50 disabled:opacity-40 transition-colors"
                    >
                      <Unlink className="size-3" />
                      Reverse
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {credit.applications.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-stone-400">
                  Not applied to any vendor bills yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {reverse.error && (
        <p role="alert" className="text-xs text-destructive">
          {apiErrorMessage(reverse.error, 'Failed to reverse vendor credit application.')}
        </p>
      )}

      {applyOpen && (
        <ApplyToBillDialog
          credit={credit}
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
