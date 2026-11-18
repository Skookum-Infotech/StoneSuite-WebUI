import { cn } from '@/lib/utils';

// Mirrors InvoiceSummaryCard, extended with adjustment and applied/unapplied
// (Credit Memo tracks cross-invoice applications instead of a single
// amountPaid/balanceDue pair). A credit memo is one Amount, so there is no
// discount row: the Sub Total is the Amount itself.
export function CreditMemoSummaryCard({ subtotal, taxTotal, adjustment, total, appliedTotal, currencyCode = 'USD' }: {
  subtotal: number; taxTotal: number; adjustment: number; total: number;
  /** Read-only — only apply/unapply (via CreditMemoService) change this;
   *  there's no free-text "applied" field in the form. */
  appliedTotal: number;
  currencyCode?: string;
}) {
  const fmt = (value: number) =>
    value.toLocaleString(undefined, { style: 'currency', currency: currencyCode });

  const unappliedAmount = total - appliedTotal;

  const rows = [
    { label: 'Sub Total', value: fmt(subtotal), muted: true },
    { label: 'Tax Total', value: fmt(taxTotal), muted: true },
    { label: 'Adjustment', value: fmt(adjustment), muted: true },
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
        {appliedTotal > 0 && (
          <div className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs text-ink-muted">Applied Total</span>
            <span className="tabular-nums text-xs font-semibold text-success-ink">{fmt(appliedTotal)}</span>
          </div>
        )}
        <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-t border-stone-200">
          <span className="text-xs text-ink font-medium">Unapplied Amount</span>
          <span className="tabular-nums text-sm font-bold text-ink-strong">{fmt(unappliedAmount)}</span>
        </div>
      </div>
    </div>
  );
}
