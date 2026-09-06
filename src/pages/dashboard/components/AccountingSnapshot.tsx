import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { relativeTime } from '@/lib/recentRecordRoute';
import { WidgetCard } from './WidgetCard';
import { MoreHint } from './MoreHint';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import type { AccountingSnapshotData } from '@/types/dashboardData';

// Matches the other half-size widgets' row count (inventoryAlertsLimit,
// topCustomersLimit are both 5 server-side) now that this card is the same
// width as they are.
const LIMIT = 5;

// Locale pinned to 'en-US' -- see SalesOrdersSnapshot.tsx's currency() for
// why an unpinned locale silently misformats USD amounts.
function currency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function AccountingSnapshot({
  data,
  isLoading,
  isError,
}: {
  data: AccountingSnapshotData | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <WidgetCard title="Accounting snapshot">
        <Spinner label="Loading accounting snapshot…" />
      </WidgetCard>
    );
  }

  if (isError || !data) {
    return (
      <WidgetCard title="Accounting snapshot">
        <ErrorNote>Couldn&apos;t load accounting snapshot.</ErrorNote>
      </WidgetCard>
    );
  }

  const visible = data.entries.slice(0, LIMIT);

  return (
    <WidgetCard title="Accounting snapshot" subtitle={`${data.entryTotal} entries this period`}>
      {data.period ? (
        <button
          type="button"
          onClick={() => navigate('/finance/accounting-periods')}
          aria-label={`View accounting periods, current period ${data.period.name}, ${data.period.status}`}
          className="flex w-full items-center justify-between rounded-xl bg-stone-50 p-3 text-left hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="text-xs font-semibold text-stone-950">{data.period.name}</span>
          <span
            className={cn(
              'rounded-full px-2 py-0.5 text-2xs font-bold',
              data.period.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600',
            )}
          >
            {data.period.status === 'open' ? 'Open' : 'Closed'}
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => navigate('/finance/accounting-periods')}
          aria-label="Set up your accounting calendar"
          className="w-full rounded-xl bg-stone-50 p-3 text-left text-xs text-stone-500 hover:bg-stone-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          No accounting calendar configured — set one up.
        </button>
      )}

      {visible.length === 0 ? (
        <p className="mt-4 text-xs text-stone-400">No journal entries posted yet.</p>
      ) : (
        <>
          <div className="mt-3 flex flex-col divide-y divide-stone-100">
            {visible.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2.5 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/finance/journal-entries/${e.id}`)}
                    aria-label={`View journal entry ${e.entryNumber}, ${e.description}`}
                    className="truncate rounded text-left text-xs font-semibold text-stone-950 hover:text-accent-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {e.description}
                  </button>
                  <div className="font-mono text-2xs text-stone-500">{e.entryNumber}</div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="text-xs font-bold text-stone-950 tabular-nums">{currency(e.amount)}</div>
                  <time dateTime={e.date} title={new Date(e.date).toLocaleString()} className="text-2xs text-stone-500">
                    {relativeTime(e.date)}
                  </time>
                </div>
              </div>
            ))}
          </div>
          <MoreHint count={data.entryTotal - visible.length} label="more entries" />
        </>
      )}
    </WidgetCard>
  );
}
