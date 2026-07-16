import { useState } from 'react';
import { createPortal } from 'react-dom';
import { DollarSign } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { creditMemoService } from '@/services/creditMemoService';
import { apiErrorMessage } from '@/api/tenantClient';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { InvoicePicker, type InvoiceRef } from './InvoicePicker';

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

// Applies part of a credit memo's unapplied balance to an invoice — mirrors
// Payment's ApplyDialog (kept as its own file rather than inlined at the
// bottom of the Detail page, unlike PaymentDetailPage's original).
export function ApplyCreditMemoDialog({ creditMemoId, customer, unappliedAmount, excludeIds, onClose, onApplied }: {
  creditMemoId: string;
  customer: { id: string; name: string };
  unappliedAmount: number;
  excludeIds: string[];
  onClose: () => void;
  onApplied: () => void;
}) {
  const [invoice, setInvoice] = useState<InvoiceRef | null>(null);
  const [amount, setAmount] = useState('');

  const apply = useMutation({
    mutationFn: () => creditMemoService.apply(creditMemoId, invoice!.id, parseFloat(amount)),
    onSuccess: onApplied,
  });

  const parsedAmount = parseFloat(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="apply-credit-memo-dialog-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
            <DollarSign className="size-4 text-emerald-600" />
          </div>
          <div>
            <h3 id="apply-credit-memo-dialog-title" className="text-sm font-bold text-stone-900">
              Apply to invoice
            </h3>
            <p className="text-xs text-stone-400 mt-0.5">
              Unapplied balance: {currency(unappliedAmount)}
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className={fieldLabelCls}>Invoice</label>
            <div className="mt-1.5">
              <InvoicePicker customer={customer} value={invoice} onChange={setInvoice} excludeIds={excludeIds} />
            </div>
          </div>
          <div>
            <label htmlFor="apply-credit-memo-amount" className={fieldLabelCls}>Amount</label>
            <input
              id="apply-credit-memo-amount"
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

        {apply.error && (
          <p className="mt-3 text-xs text-destructive">
            {apiErrorMessage(apply.error, 'Failed to apply credit memo.')}
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
            disabled={apply.isPending || !invoice || !validAmount}
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
