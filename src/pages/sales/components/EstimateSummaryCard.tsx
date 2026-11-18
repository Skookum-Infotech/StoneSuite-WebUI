import { cn } from '@/lib/utils';

// Mirrors InvoiceSummaryCard, minus amountPaid/balanceDue — an estimate has
// no payment tracking (that only exists on Invoice).
export function EstimateSummaryCard({ subtotal, discountAmt, taxTotal, total }: {
  subtotal: number; discountAmt: number; taxTotal: number; total: number;
}) {
  const fmt = (n: number) =>
    '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

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
      </div>
    </div>
  );
}
