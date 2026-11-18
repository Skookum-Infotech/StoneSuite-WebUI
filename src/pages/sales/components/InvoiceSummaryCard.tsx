import { cn } from '@/lib/utils';
import { formatMoney } from '@/lib/formatMoney';

// Mirrors SalesOrderSummaryCard, extended with amountPaid/balanceDue —
// Invoice (unlike Sales Order) tracks payments directly on the header.
export function InvoiceSummaryCard({ subtotal, discountAmt, taxTotal, total, amountPaid, currencyCode }: {
  subtotal: number; discountAmt: number; taxTotal: number; total: number;
  /** Read-only — it only changes when a payment is applied to the invoice;
   *  there's no free-text "amount paid" field in the form. */
  amountPaid: number;
  /** ISO currency code of the document; falls back to the default currency. */
  currencyCode?: string;
}) {
  const fmt = (n: number) => formatMoney(n, currencyCode);

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
        <p className="type-overline">Summary</p>
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
            <span className={cn('text-xs', muted ? 'text-ink-muted' : 'text-ink font-medium')}>
              {label}
            </span>
            <span className={cn(
              'tabular-nums',
              muted ? 'text-xs font-semibold text-ink' : 'text-sm font-bold text-ink-strong',
            )}>
              {value}
            </span>
          </div>
        ))}
        {amountPaid > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs text-ink-muted">Amount Paid</span>
            <span className="tabular-nums text-xs font-semibold text-success-ink">{fmt(amountPaid)}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-t border-stone-200">
          <span className="text-xs text-ink font-medium">Balance Due</span>
          <span className="tabular-nums text-sm font-bold text-ink-strong">{fmt(balanceDue)}</span>
        </div>
      </div>
    </div>
  );
}
