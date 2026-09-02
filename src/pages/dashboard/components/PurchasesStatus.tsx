import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { attentionKindLabel, attentionRowHref, formatAttentionDetail } from '@/lib/purchasesStatus';
import { WidgetCard } from './WidgetCard';
import { MoreHint } from './MoreHint';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import type { PurchasesStatusData } from '@/types/dashboardData';

// Locale pinned to 'en-US' -- see SalesOrdersSnapshot.tsx's currency() for
// why an unpinned locale silently misformats USD amounts.
function currency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function PurchasesStatus({
  data,
  isLoading,
  isError,
}: {
  data: PurchasesStatusData | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <WidgetCard title="Purchases & requisitions">
        <Spinner label="Loading purchases status…" />
      </WidgetCard>
    );
  }

  if (isError || !data) {
    return (
      <WidgetCard title="Purchases & requisitions">
        <ErrorNote>Couldn&apos;t load purchases status.</ErrorNote>
      </WidgetCard>
    );
  }

  const overdueActive = data.overdue.count > 0;

  return (
    <WidgetCard title="Purchases & requisitions" subtitle="status">
      <div className="grid grid-cols-3 gap-2.5">
        <div className="rounded-xl bg-stone-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500">Pending</div>
          <div className="mt-1 text-lg font-bold tabular-nums text-stone-950">
            {data.pending ? data.pending.count : <span className="text-stone-300">—</span>}
          </div>
          {data.pending && <div className="text-2xs text-stone-500 tabular-nums">{currency(data.pending.value)}</div>}
        </div>
        <div className="rounded-xl bg-stone-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500">Incoming</div>
          <div className="mt-1 text-lg font-bold text-stone-950 tabular-nums">{data.incoming.count}</div>
          <div className="text-2xs text-stone-500 tabular-nums">{currency(data.incoming.value)}</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-3">
          <div className="text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500">Overdue</div>
          <div className={cn('mt-1 text-lg font-bold tabular-nums', overdueActive ? 'text-warning' : 'text-stone-950')}>
            {data.overdue.count}
          </div>
          <div className={cn('text-2xs tabular-nums', overdueActive ? 'text-warning' : 'text-stone-500')}>
            {currency(data.overdue.value)}
          </div>
        </div>
      </div>

      {data.attention.length === 0 ? (
        <p className="mt-4 text-xs text-stone-400">Nothing needs attention right now.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-col divide-y divide-stone-100">
            {data.attention.map((row) => (
              <div key={`${row.kind}-${row.id}`} className="flex items-center justify-between gap-2.5 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="shrink-0 rounded bg-stone-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-stone-500">
                      {attentionKindLabel(row)}
                    </span>
                    <button
                      type="button"
                      onClick={() => navigate(attentionRowHref(row))}
                      aria-label={`View ${row.kind === 'purchase_order' ? 'purchase order' : 'requisition'} ${row.party}, ${row.recordNumber}`}
                      className="truncate rounded text-left text-xs font-semibold text-stone-950 hover:text-accent-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {row.party}
                    </button>
                  </div>
                  <div className={cn('mt-0.5 text-2xs', row.daysOverdue !== null ? 'text-warning' : 'text-stone-500')}>
                    <span className="font-mono">{row.recordNumber}</span> · {formatAttentionDetail(row)}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs font-bold text-stone-950 tabular-nums">{currency(row.value)}</div>
              </div>
            ))}
          </div>
          <MoreHint count={data.attentionCount - data.attention.length} label="more needing attention" />
        </>
      )}
    </WidgetCard>
  );
}
