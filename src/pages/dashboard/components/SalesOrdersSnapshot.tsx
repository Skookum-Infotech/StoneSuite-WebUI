import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatDueLabel } from '@/lib/salesOrderDue';
import { WidgetCard } from './WidgetCard';
import { MoreHint } from './MoreHint';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import type { SalesOrdersSnapshotData } from '@/types/dashboardData';

// Locale is pinned to 'en-US' rather than the runtime default -- the amount
// is always USD, and an unpinned locale renders Indian digit grouping
// ($4,12,300 instead of $412,300) for any viewer whose browser/OS default
// isn't already US-English, which silently misformats real money.
function currency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function SalesOrdersSnapshot({
  data,
  isLoading,
  isError,
}: {
  data: SalesOrdersSnapshotData | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <WidgetCard title="Sales orders snapshot">
        <Spinner label="Loading sales orders…" />
      </WidgetCard>
    );
  }

  if (isError || !data) {
    return (
      <WidgetCard title="Sales orders snapshot">
        <ErrorNote>Couldn&apos;t load sales orders snapshot.</ErrorNote>
      </WidgetCard>
    );
  }

  return (
    <WidgetCard title="Sales orders snapshot" subtitle="open orders · approved & beyond">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-stone-50 p-2 sm:p-2.5 lg:p-3">
          <div className="truncate type-overline">Open</div>
          <div className="mt-1 text-sm font-bold text-ink-strong tabular-nums sm:text-base lg:text-lg">{data.openCount}</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-2 sm:p-2.5 lg:p-3">
          <div className="truncate type-overline">Backlog</div>
          <div className="mt-1 text-sm font-bold text-ink-strong tabular-nums sm:text-base lg:text-lg">{currency(data.openValue)}</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-2 sm:p-2.5 lg:p-3">
          <div className="truncate type-overline">Late</div>
          <div className={cn('mt-1 text-sm font-bold tabular-nums sm:text-base lg:text-lg', data.lateCount > 0 ? 'text-warning' : 'text-ink-strong')}>
            {data.lateCount}
          </div>
          {data.lateCount > 0 && <div className="type-subline tabular-nums">{currency(data.lateValue)}</div>}
        </div>
      </div>

      {data.statuses.length > 0 && (
        <p className="mt-3 type-helper">
          {data.statuses.map((s, i) => (
            <span key={s.code}>
              {i > 0 && ' · '}
              {s.label} {s.count}
            </span>
          ))}
        </p>
      )}

      {data.atRisk.length === 0 ? (
        <div className="mt-4 flex-1 rounded-xl border border-dashed border-stone-300 p-4 text-center text-sm text-ink-muted">
          No open sales orders to show.
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-col divide-y divide-stone-100">
            {data.atRisk.map((o) => {
              const due = formatDueLabel(o.daysLate);
              return (
                <div key={o.id} className="flex items-center justify-between gap-2.5 py-2 first:pt-0 last:pb-0">
                  <div className="min-w-0">
                    <div className="truncate type-cell-strong">{o.customer}</div>
                    <button
                      type="button"
                      onClick={() => navigate(`/sales/sales_order/${o.id}`)}
                      aria-label={`View sales order ${o.recordNumber} for ${o.customer}`}
                      className="rounded font-mono text-caption text-ink-muted hover:text-accent-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      {o.recordNumber}
                    </button>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="type-cell-strong">{currency(o.value)}</div>
                    <div className="type-subline">{o.status}</div>
                    <div className={cn('text-micro font-medium', due.warn ? 'text-warning-ink' : 'text-ink-muted')}>{due.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <MoreHint count={data.openCount - data.atRisk.length} label="more open orders" />
        </>
      )}
    </WidgetCard>
  );
}
