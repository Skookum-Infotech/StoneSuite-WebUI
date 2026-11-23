import { createPortal } from 'react-dom';
import { TriangleAlert } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useModalDialog } from '@/hooks/useModalDialog';
import { excessBreakdown, type AppliedInvoiceLine } from '@/lib/paymentExcess';

export interface ExcessPaymentPrompt {
  customerName: string;
  /** The invoices the payment is compared with: every "Apply to Invoices" row
   *  plus the invoice selected in the picker but not yet added. */
  applications: AppliedInvoiceLine[];
  /** What the Payment Amount field currently says. */
  paymentAmount: number;
  /** The larger of paymentAmount and the applied total — what is saved on Yes. */
  enteredAmount: number;
  balanceTotal: number;
  excessAmount: number;
  currencyId: number | null;
  currencyCode: string;
  canCreateCreditMemo: boolean;
}

function money(value: number, currencyCode: string): string {
  return value.toLocaleString(undefined, { style: 'currency', currency: currencyCode });
}

export function ExcessPaymentDialog({ prompt, onConfirm, onReject }: {
  prompt: ExcessPaymentPrompt;
  onConfirm: () => void;
  onReject: () => void;
}) {
  const contentRef = useModalDialog(onReject);
  const { currencyCode } = prompt;
  const invoiceNumbers = prompt.applications.map((application) => application.invoiceNumber).join(', ');
  const raisesPaymentAmount = prompt.enteredAmount > prompt.paymentAmount;
  const breakdown = excessBreakdown(prompt.enteredAmount, prompt.excessAmount, prompt.applications);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 p-4 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="excess-payment-title"
      aria-describedby="excess-payment-description"
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 w-full max-w-md rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-warning/10">
            <TriangleAlert className="size-4 text-warning" aria-hidden="true" />
          </div>
          <h3 id="excess-payment-title" className="text-sm font-bold text-stone-900">
            Payment exceeds invoice balance
          </h3>
        </div>

        <div id="excess-payment-description" className="space-y-3 text-xs text-stone-600">
          <p>
            The amount received is more than the balance due on {invoiceNumbers}. Add the extra {money(prompt.excessAmount, currencyCode)} to Credit Memos? If the amount received was a typo, choose No and correct it.
          </p>
          <div className="max-h-44 overflow-y-auto rounded-lg border border-stone-200 modal-scrollbar">
            <table className="w-full tabular-nums">
              <caption className="sr-only">Amount applied to each invoice</caption>
              <thead className="bg-stone-50 text-2xs uppercase tracking-wide text-stone-500">
                <tr>
                  <th scope="col" className="px-3 py-1.5 text-left font-semibold">Invoice</th>
                  <th scope="col" className="px-3 py-1.5 text-right font-semibold">Balance due</th>
                  <th scope="col" className="px-3 py-1.5 text-right font-semibold">Amount applied</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {breakdown.rows.map((row) => (
                  <tr key={row.invoiceUuid}>
                    <th scope="row" className="px-3 py-1.5 text-left font-medium text-stone-700">{row.invoiceNumber}</th>
                    <td className="px-3 py-1.5 text-right text-stone-600">{money(row.balanceDue, currencyCode)}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-stone-800">{money(row.appliedAmount, currencyCode)}</td>
                  </tr>
                ))}
              </tbody>
              {breakdown.rows.length > 1 && (
                <tfoot className="border-t border-stone-200 bg-stone-50 font-semibold text-stone-800">
                  <tr>
                    <th scope="row" className="px-3 py-1.5 text-left">Total</th>
                    <td className="px-3 py-1.5 text-right">{money(breakdown.balanceTotal, currencyCode)}</td>
                    <td className="px-3 py-1.5 text-right">{money(breakdown.appliedTotal, currencyCode)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          <dl className="space-y-1 rounded-lg border border-stone-200 bg-stone-50 p-3 tabular-nums">
            <div className="flex items-center justify-between gap-3">
              <dt>Amount received</dt>
              <dd className="font-medium text-stone-700">{money(prompt.enteredAmount, currencyCode)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt>Applied to invoices</dt>
              <dd className="font-medium text-stone-700">{money(breakdown.appliedTotal, currencyCode)}</dd>
            </div>
            {breakdown.unappliedRemainder > 0 && (
              <div className="flex items-center justify-between gap-3">
                <dt>Left unapplied on the payment</dt>
                <dd className="font-medium text-stone-700">{money(breakdown.unappliedRemainder, currencyCode)}</dd>
              </div>
            )}
            <div className="flex items-center justify-between gap-3 border-t border-stone-200 pt-1">
              <dt className="font-semibold text-stone-800">Extra, to Credit Memo</dt>
              <dd className="font-semibold text-stone-900">{money(prompt.excessAmount, currencyCode)}</dd>
            </div>
          </dl>
          {raisesPaymentAmount && (
            <p>
              The payment will be saved as {money(prompt.enteredAmount, currencyCode)}; the Amount field currently says {money(prompt.paymentAmount, currencyCode)}.
            </p>
          )}
          {prompt.canCreateCreditMemo ? (
            <p>
              Yes saves the payment, applies the amounts shown to each invoice, and opens a draft Credit Memo for {prompt.customerName} with the extra amount. Review and save that memo separately. No lets you enter a correct amount instead.
            </p>
          ) : (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 font-medium text-red-700">
              You do not have permission to create Credit Memos, or the Credit Memo form is disabled. Choose No and enter an amount up to the invoice balance.
            </p>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onReject}
            aria-label="No, enter a correct amount"
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
          >
            No, enter correct amount
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={!prompt.canCreateCreditMemo}
            aria-label="Yes, save the payment and continue to a credit memo"
            className={cn(
              'rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-sm transition-all',
              'hover:bg-brand-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-brand',
            )}
          >
            Yes, save and continue
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
