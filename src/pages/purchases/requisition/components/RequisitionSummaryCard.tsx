import { cn } from '@/lib/utils';

// Mirrors PurchaseOrderSummaryCard with only the three rows a requisition
// carries — there is no discount, shipping, or adjustment on a requisition
// (those belong to the purchase order it converts into). "Estimated Total"
// rather than "Grand Total": these are the requester's estimates, not agreed
// vendor prices.
export function RequisitionSummaryCard({
  subtotal, taxTotal, estimatedTotal,
}: {
  subtotal: number; taxTotal: number; estimatedTotal: number;
}) {
  const fmt = (n: number) =>
    (n < 0 ? '-$' : '$') + Math.abs(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const rows = [
    { label: 'Sub Total', value: fmt(subtotal), muted: true },
    { label: 'Tax Total', value: fmt(taxTotal), muted: true },
    { label: 'Estimated Total', value: fmt(estimatedTotal), muted: false },
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
