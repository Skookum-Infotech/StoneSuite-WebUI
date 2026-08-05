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
      </div>
    </div>
  );
}
