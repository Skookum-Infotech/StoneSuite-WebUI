import { cn } from '@/lib/utils';
import { WidgetCard } from './WidgetCard';
import { MoreHint } from './MoreHint';
import type { PurchaseStatusItem } from '../mockData';

const LIMIT = 4;

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function PurchasesStatus({ items }: { items: PurchaseStatusItem[] }) {
  const pendingApproval = items.filter((i) => i.status === 'pending_approval');
  const incoming = items.filter((i) => i.status === 'incoming');
  const overdueReceipts = items.filter((i) => i.status === 'overdue_receipt');
  const attentionItems = [...pendingApproval, ...overdueReceipts];
  const needsAttention = attentionItems.slice(0, LIMIT);

  return (
    <WidgetCard title="Purchases & requisitions" subtitle="status">
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-stone-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500">Pending</div>
          <div className="mt-1 text-lg font-bold text-stone-950 tabular-nums">{pendingApproval.length}</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500">Incoming</div>
          <div className="mt-1 text-lg font-bold text-stone-950 tabular-nums">{incoming.length}</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500">Overdue</div>
          <div
            className={cn(
              'mt-1 text-lg font-bold tabular-nums',
              overdueReceipts.length > 0 ? 'text-warning' : 'text-stone-950',
            )}
          >
            {overdueReceipts.length}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-col divide-y divide-stone-100">
        {needsAttention.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2.5 py-2 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-stone-950">{item.vendor}</div>
              <div className="font-mono text-2xs text-stone-500">{item.recordNumber}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs font-bold text-stone-950 tabular-nums">{currency(item.amount)}</div>
              <div className="text-2xs text-stone-500">{item.detail}</div>
            </div>
          </div>
        ))}
      </div>
      <MoreHint count={attentionItems.length - LIMIT} label="more needing attention" />
    </WidgetCard>
  );
}
