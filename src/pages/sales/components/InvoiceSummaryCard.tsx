import { cn } from '@/lib/utils';

// Mirrors SalesOrderSummaryCard, extended with amountPaid/balanceDue —
// Invoice (unlike Sales Order) tracks payments directly on the header.
export function InvoiceSummaryCard({ subtotal, discountAmt, taxTotal, total, amountPaid }: {
  subtotal: number; discountAmt: number; taxTotal: number; total: number;
  /** Read-only — only `invoiceService.recordPayment` (via RecordPaymentDialog)
   *  changes this; there's no free-text "amount paid" field in the form. */
  amountPaid: number;
}) {
  const fmt = (n: number) =>
    '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const balanceDue = total - amountPaid;

  const rows = [
    { label: 'Sub Total', value: fmt(subtotal), muted: true },
    { label: 'Discount', value: fmt(discountAmt), muted: true },
    { label: 'Tax Total', value: fmt(taxTotal), muted: true },
    { label: 'Total', value: fmt(total), muted: false },
  ];

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden sticky top-4">
      <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200">
        <p className="text-2xs font-semibold uppercase tracking-wide text-stone-500">Summary</p>
      </div>
      <div className="divide-y divide-stone-100">
        {rows.map(({ label, value, muted }) => (
          <div
            key={label}
            className={cn(
              'flex items-center justify-between px-4 py-2.5',
              !muted && 'bg-stone-50 border-t border-stone-200',
            )}
          >
            <span className={cn('text-xs', muted ? 'text-stone-500' : 'text-stone-700 font-medium')}>
              {label}
            </span>
            <span className={cn(
              'tabular-nums',
              muted ? 'text-xs font-semibold text-stone-600' : 'text-sm font-bold text-stone-900',
            )}>
              {value}
            </span>
          </div>
        ))}
        {amountPaid > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs text-stone-500">Amount Paid</span>
            <span className="tabular-nums text-xs font-semibold text-emerald-600">{fmt(amountPaid)}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-t border-stone-200">
          <span className="text-xs text-stone-700 font-medium">Balance Due</span>
          <span className="tabular-nums text-sm font-bold text-stone-900">{fmt(balanceDue)}</span>
        </div>
      </div>
    </div>
  );
}
