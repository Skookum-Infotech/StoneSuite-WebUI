import { useState } from 'react';
import { createPortal } from 'react-dom';
import { DollarSign } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceService } from '@/services/invoiceService';
import { apiErrorMessage } from '@/api/tenantClient';
import { fieldCls } from '@/components/crm/formUtils';
import { INVOICE_PAYABLE_STATUSES } from '@/lib/invoiceForm';

// Records a payment against an invoice. The backend only accepts a positive
// `amount` (no date/method fields — invoice/store_transition.go's
// RecordPayment) and only against a SENT/PART/ODUE invoice; it auto-transitions
// to PART or PAID depending on whether the payment covers the balance.
export function RecordPaymentDialog({ invoiceId, statusCode, balanceDue, onRecorded }: {
  invoiceId: string;
  statusCode: string;
  balanceDue: number;
  onRecorded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const queryClient = useQueryClient();

  const payable = INVOICE_PAYABLE_STATUSES.has(statusCode);

  const record = useMutation({
    mutationFn: () => invoiceService.recordPayment(invoiceId, parseFloat(amount)),
    onSuccess: () => {
      setOpen(false);
      setAmount('');
      queryClient.invalidateQueries({ queryKey: ['invoice', invoiceId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      onRecorded();
    },
  });

  const parsedAmount = parseFloat(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!payable}
        aria-label="Record payment"
        title={payable ? undefined : `Cannot record a payment on a ${statusCode} invoice; it must be sent first.`}
        className="flex items-center gap-2.5 hover:bg-stone-50 rounded-lg px-3 py-2 cursor-pointer text-xs text-stone-700 w-full transition-colors text-left disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        <DollarSign className="size-4 text-stone-400 shrink-0" />
        Record payment
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-payment-dialog-title"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <DollarSign className="size-4 text-emerald-600" />
              </div>
              <div>
                <h3 id="record-payment-dialog-title" className="text-sm font-bold text-stone-900">
                  Record payment
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Balance due: ${balanceDue.toFixed(2)}
                </p>
              </div>
            </div>

            <label htmlFor="payment-amount" className="block text-xs font-semibold text-stone-900 mb-1.5">
              Amount
            </label>
            <input
              id="payment-amount"
              type="number"
              min="0.01"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              autoFocus
              className={fieldCls}
              aria-label="Payment amount"
            />

            {record.error && (
              <p className="mt-3 text-xs text-destructive">
                {apiErrorMessage(record.error, 'Failed to record payment.')}
              </p>
            )}

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={record.isPending}
                className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => record.mutate()}
                disabled={record.isPending || !validAmount}
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed active:scale-95 transition-all"
              >
                {record.isPending ? 'Recording…' : 'Record payment'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
