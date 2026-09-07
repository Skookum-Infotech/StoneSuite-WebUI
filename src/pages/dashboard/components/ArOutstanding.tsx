import { useNavigate } from 'react-router-dom';
import { WidgetCard } from './WidgetCard';
import { MoreHint } from './MoreHint';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import type { ArAgingBucket, ArOutstandingData } from '@/types/dashboardData';

// Locale pinned to 'en-US' -- see SalesOrdersSnapshot.tsx's currency() for
// why an unpinned locale silently misformats USD amounts.
function currency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

const BUCKET_COLOR: Record<ArAgingBucket['label'], string> = {
  '0-30': '#c2f589',
  '31-60': '#d97706',
  '61-90': '#ea580c',
  '90+': '#dc2626',
};

export function ArOutstanding({
  data,
  isLoading,
  isError,
}: {
  data: ArOutstandingData | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <WidgetCard title="Accounts receivable">
        <Spinner label="Loading accounts receivable…" />
      </WidgetCard>
    );
  }

  if (isError || !data) {
    return (
      <WidgetCard title="Accounts receivable">
        <ErrorNote>Couldn&apos;t load accounts receivable.</ErrorNote>
      </WidgetCard>
    );
  }

  const maxBucket = Math.max(...data.buckets.map((b) => b.amount), 1);

  return (
    <WidgetCard title="Accounts receivable" subtitle="outstanding invoices">
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-stone-50 p-2 sm:p-2.5 lg:p-3">
          <div className="truncate text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500">Outstanding</div>
          <div className="mt-1 text-sm font-bold text-stone-950 tabular-nums sm:text-base lg:text-lg">{currency(data.outstanding)}</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-2 sm:p-2.5 lg:p-3">
          <div className="truncate text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500">Overdue</div>
          <div className="mt-1 text-sm font-bold text-warning tabular-nums sm:text-base lg:text-lg">{currency(data.overdueTotal)}</div>
        </div>
        <div className="rounded-xl bg-stone-50 p-2 sm:p-2.5 lg:p-3">
          <div className="truncate text-[10px] font-semibold uppercase tracking-[.09em] text-stone-500"># Overdue</div>
          <div className="mt-1 text-sm font-bold text-stone-950 tabular-nums sm:text-base lg:text-lg">{data.overdueCount}</div>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-[9px]">
        {data.buckets.map((b) => (
          <div key={b.label} className="flex items-center gap-[11px]">
            <span className="w-12 shrink-0 text-2xs font-semibold text-stone-500">{b.label}d</span>
            <div className="h-[9px] flex-1 overflow-hidden rounded-full bg-stone-100">
              <div
                className="h-full rounded-full"
                style={{ width: `${(b.amount / maxBucket) * 100}%`, backgroundColor: BUCKET_COLOR[b.label] }}
              />
            </div>
            <span className="w-16 shrink-0 text-right text-xs font-bold text-stone-950 tabular-nums">
              {currency(b.amount)}
            </span>
          </div>
        ))}
      </div>

      {data.oldest.length === 0 ? (
        <p className="mt-4 text-xs text-stone-400">Nothing outstanding right now.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-col divide-y divide-stone-100">
            {data.oldest.map((row) => (
              <div key={row.id} className="flex items-center justify-between gap-2.5 py-2 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <button
                    type="button"
                    onClick={() => navigate(`/sales/invoice/${row.id}`)}
                    aria-label={`View invoice ${row.invoiceNumber}, ${row.customer}`}
                    className="truncate rounded text-left text-xs font-semibold text-stone-950 hover:text-accent-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {row.customer}
                  </button>
                  <div className={row.daysPastDue > 0 ? 'mt-0.5 text-2xs text-warning' : 'mt-0.5 text-2xs text-stone-500'}>
                    <span className="font-mono">{row.invoiceNumber}</span>
                    {row.daysPastDue > 0 ? ` · ${row.daysPastDue}d past due` : null}
                  </div>
                </div>
                <div className="shrink-0 text-right text-xs font-bold text-stone-950 tabular-nums">{currency(row.balanceDue)}</div>
              </div>
            ))}
          </div>
          <MoreHint count={data.oldestCount - data.oldest.length} label="more outstanding" />
        </>
      )}
    </WidgetCard>
  );
}
