import { useState } from 'react';
import { AlertTriangle, Loader2, ShoppingBag, Truck, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useOrderShortageItems } from '@/hooks/useOrderShortageItems';
import {
  itemsShortLabel, onOrderSentence, onOrderShortages, shortItemsSentence, uncoveredShortages,
} from '@/lib/stockShortage';
import type { StockShortage } from '@/types/salesOrder';

// The stock warning on a Sales Order. Short stock never stops an order: it is
// saved holding the full quantity, and this banner stays on the order for as
// long as inventory cannot cover it (the server works it out on every read), so
// whoever opens the order later sees it too. Stock nobody has ordered yet gets
// the amber "items short" warning and the button to order it; stock a sent
// purchase order is already bringing gets a quieter "on order" note. Dismiss
// hides it until the page is opened again.
export function StockShortageBanner({ orderNumber, shortages }: { orderNumber: string; shortages: StockShortage[] }) {
  const [dismissed, setDismissed] = useState(false);
  const { hasPermission, isLoading } = useUserPermissions();
  const { order, isPending } = useOrderShortageItems();
  const uncovered = uncoveredShortages(shortages);
  const incoming = onOrderShortages(shortages);
  if (dismissed || (uncovered.length === 0 && incoming.length === 0)) return null;
  const isShort = uncovered.length > 0;
  const canOrder = isShort && !isLoading && hasPermission('purchase_order', 'create');
  const order_ = orderNumber || 'This order';

  return (
    <div
      role={isShort ? 'alert' : 'status'}
      className={cn(
        'flex shrink-0 items-start gap-3 border-b px-5 py-2.5 3xl:px-12 4xl:px-16',
        isShort ? 'border-amber-200 bg-amber-50' : 'border-sky-200 bg-sky-50',
      )}
    >
      <span className={cn('mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full', isShort ? 'bg-amber-100' : 'bg-sky-100')}>
        {isShort
          ? <AlertTriangle className="size-3 text-amber-700" aria-hidden="true" />
          : <Truck className="size-3 text-sky-700" aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        {isShort ? (
          <>
            <p className="text-xs font-bold text-amber-900">{itemsShortLabel(uncovered)}: delivery may be delayed</p>
            <p className="mt-0.5 text-xs text-amber-800">
              {order_} was created, but inventory doesn&apos;t cover {shortItemsSentence(uncovered)}.
              Delivery will be delayed until this stock is received.
              {incoming.length > 0 && <> Already on order: {onOrderSentence(incoming)}.</>}
            </p>
          </>
        ) : (
          <>
            <p className="text-xs font-bold text-sky-900">Stock on order: delivery waits for it to arrive</p>
            <p className="mt-0.5 text-xs text-sky-800">
              {order_} is covered by stock on its way: {onOrderSentence(incoming)}.
              Delivery can go ahead once it&apos;s received.
            </p>
          </>
        )}
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {canOrder && (
          <button
            type="button"
            onClick={() => order(uncovered)}
            disabled={isPending}
            aria-label="Order shortage items on a new purchase order"
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 shadow-sm transition-all hover:bg-brand-hover active:scale-95 disabled:opacity-60"
          >
            {isPending
              ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              : <ShoppingBag className="size-3.5" aria-hidden="true" />}
            Order shortage items
          </button>
        )}
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label="Dismiss the stock shortage warning"
          className={cn('rounded-lg p-1.5 transition-colors', isShort ? 'text-amber-700 hover:bg-amber-100' : 'text-sky-700 hover:bg-sky-100')}
        >
          <X className="size-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
