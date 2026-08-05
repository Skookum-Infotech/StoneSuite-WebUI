import { cn } from '@/lib/utils';
import { WidgetCard } from './WidgetCard';
import { MoreHint } from './MoreHint';
import type { OpenSalesOrder } from '../mockData';

const LIMIT = 4;

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function SalesOrdersSnapshot({ orders }: { orders: OpenSalesOrder[] }) {
  const openValue = orders.reduce((sum, o) => sum + o.value, 0);
  const overdueCount = orders.filter((o) => o.isOverdue).length;
  const recent = orders.slice(0, LIMIT);

  return (
    <WidgetCard title="Sales orders snapshot" subtitle="open orders">
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-stone-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500">Open</div>
          <div className="mt-1 text-lg font-bold text-stone-950 tabular-nums">{orders.length}</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500">Value</div>
          <div className="mt-1 text-lg font-bold text-stone-950 tabular-nums">{currency(openValue)}</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500">Overdue</div>
          <div
            className={cn(
              'mt-1 text-lg font-bold tabular-nums',
              overdueCount > 0 ? 'text-warning' : 'text-stone-950',
            )}
          >
            {overdueCount}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-stone-100">
        {recent.map((o) => (
          <div key={o.id} className="flex items-center justify-between gap-2.5 py-2 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-stone-950">{o.customer}</div>
              <div className="font-mono text-2xs text-stone-500">{o.orderNumber}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs font-bold text-stone-950 tabular-nums">{currency(o.value)}</div>
              <div className="text-2xs text-stone-500">{o.status}</div>
            </div>
          </div>
        ))}
      </div>
      <MoreHint count={orders.length - LIMIT} label="more open orders" />
    </WidgetCard>
  );
}
