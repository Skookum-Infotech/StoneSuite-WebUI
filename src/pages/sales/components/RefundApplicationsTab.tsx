import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { DollarSign, Unlink } from 'lucide-react';
import { refundService } from '@/services/refundService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  refundApplicationSource, sourceRequestBody, sourceDetailPath,
  SOURCE_KIND_LABELS, applyBlockedReason,
} from '@/lib/refundForm';
import { ApplyRefundDialog } from './ApplyRefundDialog';
import type { Refund } from '@/types/refund';

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

// The refund application ledger. Structurally this is PaymentDetailPage's
// Applications tab, but each row's counterparty is a *source* the money is
// drawn FROM (a payment's overpayment or a credit memo's unapplied credit),
// not a target it is applied TO — hence the extra Source column: with two
// possible document types in one ledger, a bare number like "PYMT-000001" vs
// "CM-000001" is not a reliable cue for which endpoint an unapply hits.
export function RefundApplicationsTab({ refund }: { refund: Refund }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [applyOpen, setApplyOpen] = useState(false);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('refund', 'update');

  const unapply = useMutation({
    mutationFn: (source: { kind: 'payment' | 'credit_memo'; id: string }) =>
      refundService.unapply(refund.id, sourceRequestBody(source)),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['refund', refund.id] }),
  });

  const blockedReason = applyBlockedReason(refund.statusCode, refund.unappliedAmount);
  // A row's unapply is blocked by status for the same reason apply is (AD-5:
  // only an APPV refund may move money), but never by an exhausted balance —
  // reversing an application is what *restores* the balance.
  const rowActionBlocked = applyBlockedReason(refund.statusCode, Number.POSITIVE_INFINITY) !== null;

  return (
    <div className="space-y-3">
      {canEdit && (
        <div className="flex items-center justify-end gap-3">
          {/* Rendered as visible text, not just a title on the disabled
              button: a disabled button is not focusable or hoverable by
              keyboard, so a tooltip would strand the one thing the user needs
              to know — that approving is the unblocking step. */}
          {blockedReason && (
            <p className="text-2xs text-stone-400">{blockedReason}</p>
          )}
          <button
            type="button"
            onClick={() => setApplyOpen(true)}
            disabled={blockedReason !== null}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            <DollarSign className="size-3.5" aria-hidden="true" />
            Draw from a source
          </button>
        </div>
      )}

      <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr className="divide-x divide-stone-200">
              {['Source', 'Document #', 'Amount', 'Applied Date', ''].map((h) => (
                <th key={h} className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {refund.applications.map((app) => {
              const source = refundApplicationSource(app);
              // Unreachable while the DB's XOR CHECK holds; skipping beats
              // rendering an undefined row.
              if (!source) return null;
              return (
                <tr key={app.id} className="hover:bg-stone-50/50 divide-x divide-stone-100">
                  <td className="px-3 py-2.5 text-stone-500 whitespace-nowrap">{SOURCE_KIND_LABELS[source.kind]}</td>
                  <td className="px-3 py-2.5 font-medium text-stone-800">
                    <button
                      type="button"
                      onClick={() => navigate(sourceDetailPath(source))}
                      className="hover:text-accent-foreground transition-colors"
                    >
                      {source.number}
                    </button>
                  </td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-700">{currency(app.amount)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-stone-400">{fmtDate(app.createdAt)}</td>
                  <td className="px-3 py-2.5 text-right">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => unapply.mutate({ kind: source.kind, id: source.id })}
                        disabled={unapply.isPending || rowActionBlocked}
                        aria-label={`Unapply refund from ${SOURCE_KIND_LABELS[source.kind].toLowerCase()} ${source.number}`}
                        className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-2xs font-medium text-stone-500 hover:bg-stone-50 disabled:opacity-40 transition-colors"
                      >
                        <Unlink className="size-3" aria-hidden="true" />
                        Unapply
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {refund.applications.length === 0 && (
              <tr>
                <td colSpan={5} className="py-8 text-center text-stone-400">
                  Not drawn from any source yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {unapply.error && (
        <p role="alert" className="text-xs text-destructive">
          {apiErrorMessage(unapply.error, 'Failed to unapply refund.')}
        </p>
      )}

      {applyOpen && (
        <ApplyRefundDialog
          refund={refund}
          onClose={() => setApplyOpen(false)}
          onApplied={() => {
            setApplyOpen(false);
            queryClient.invalidateQueries({ queryKey: ['refund', refund.id] });
          }}
        />
      )}
    </div>
  );
}
