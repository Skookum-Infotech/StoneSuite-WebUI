import { useState } from 'react';
import { createPortal } from 'react-dom';
import { DollarSign } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { vendorBillService } from '@/services/vendorBillService';
import { apiErrorMessage } from '@/api/tenantClient';
import { fieldCls, textareaCls, fieldLabelCls } from '@/components/crm/formUtils';
import { useModalDialog } from '@/hooks/useModalDialog';
import { PAYMENT_METHODS } from '@/lib/paymentMethods';
import { VB_PAYABLE_STATUSES } from '@/lib/vendorBillForm';

// Records a settlement against a vendor bill (AD-7). Only accepted on
// APPV/PART/ODUE (VB_PAYABLE_STATUSES) — the backend rejects overpayment
// with a 400 rather than silently clamping it, so this also blocks the
// submit client-side once amount would exceed balanceDue, but still
// surfaces the server's 400 verbatim if it happens anyway (e.g. a stale
// balanceDue after a concurrent payment). Mirrors sales/RecordPaymentDialog,
// plus the method/reference/memo/paidAt fields the vendor bill payment
// contract accepts that invoice's simpler one doesn't.
export function RecordBillPaymentDialog({ vendorBillId, statusCode, balanceDue, onRecorded }: {
  vendorBillId: string;
  statusCode: string;
  balanceDue: number;
  onRecorded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [methodId, setMethodId] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [memo, setMemo] = useState('');
  const [paidAt, setPaidAt] = useState('');
  const queryClient = useQueryClient();
  const contentRef = useModalDialog(() => setOpen(false));

  const payable = VB_PAYABLE_STATUSES.has(statusCode);

  const record = useMutation({
    mutationFn: () => vendorBillService.recordPayment(vendorBillId, {
      amount: parseFloat(amount),
      methodId: methodId ? Number(methodId) : undefined,
      referenceNumber: referenceNumber || undefined,
      memo: memo || undefined,
      paidAt: paidAt || undefined,
    }),
    onSuccess: () => {
      setOpen(false);
      setAmount('');
      setMethodId('');
      setReferenceNumber('');
      setMemo('');
      setPaidAt('');
      queryClient.invalidateQueries({ queryKey: ['vendor-bill', vendorBillId] });
      queryClient.invalidateQueries({ queryKey: ['vendor-bill-payments', vendorBillId] });
      queryClient.invalidateQueries({ queryKey: ['vendor-bills'] });
      onRecorded();
    },
  });

  const parsedAmount = parseFloat(amount);
  const validAmount = Number.isFinite(parsedAmount) && parsedAmount > 0 && parsedAmount <= balanceDue;
  const overAmount = Number.isFinite(parsedAmount) && parsedAmount > balanceDue;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={!payable}
        aria-label="Record payment"
        title={payable ? undefined : `Cannot record a payment on a ${statusCode} vendor bill; it must be approved first.`}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
      >
        <DollarSign className="size-3.5" />
        Record payment
      </button>

      {open && createPortal(
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="record-vb-payment-dialog-title"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl outline-none">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex size-9 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100">
                <DollarSign className="size-4 text-emerald-600" />
              </div>
              <div>
                <h3 id="record-vb-payment-dialog-title" className="text-sm font-bold text-stone-900">
                  Record payment
                </h3>
                <p className="text-xs text-stone-400 mt-0.5">
                  Balance due: ${balanceDue.toFixed(2)}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label htmlFor="vb-payment-amount" className={fieldLabelCls}>Amount</label>
                <input
                  id="vb-payment-amount"
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
                {overAmount && (
                  <p className="mt-1 text-2xs text-destructive">Amount cannot exceed the balance due.</p>
                )}
              </div>

              <div>
                <label htmlFor="vb-payment-method" className={fieldLabelCls}>Method</label>
                <select
                  id="vb-payment-method"
                  value={methodId}
                  onChange={(e) => setMethodId(e.target.value)}
                  className={fieldCls}
                  aria-label="Payment method"
                >
                  <option value="">— Select —</option>
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="vb-payment-date" className={fieldLabelCls}>Paid On</label>
                <input
                  id="vb-payment-date"
                  type="date"
                  value={paidAt}
                  onChange={(e) => setPaidAt(e.target.value)}
                  className={fieldCls}
                  aria-label="Paid on date"
                />
              </div>

              <div>
                <label htmlFor="vb-payment-reference" className={fieldLabelCls}>Reference #</label>
                <input
                  id="vb-payment-reference"
                  type="text"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  placeholder="Check #, transaction id…"
                  className={fieldCls}
                  aria-label="Reference number"
                />
              </div>

              <div>
                <label htmlFor="vb-payment-memo" className={fieldLabelCls}>Memo</label>
                <textarea
                  id="vb-payment-memo"
                  rows={2}
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                  placeholder="Optional note…"
                  className={textareaCls}
                  aria-label="Memo"
                />
              </div>
            </div>

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
