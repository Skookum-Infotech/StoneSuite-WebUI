import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { formatRevenueDelta } from '@/lib/revenueDelta';
import { WidgetCard } from './WidgetCard';
import { MoreHint } from './MoreHint';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import type { TopCustomersData } from '@/types/dashboardData';

// Mirrors KpiStrip's DELTA_TONE_CLASS (up/warn/neutral) rather than a
// separate red/green scheme.
const DELTA_TONE_CLASS: Record<'up' | 'warn' | 'neutral', string> = {
  up: 'text-brand-dark-hover',
  warn: 'text-warning',
  neutral: 'text-stone-400',
};

// Locale pinned to 'en-US' -- see SalesOrdersSnapshot.tsx's currency() for
// why an unpinned locale silently misformats USD amounts.
function currency(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function TopCustomers({
  data,
  isLoading,
  isError,
}: {
  data: TopCustomersData | undefined;
  isLoading: boolean;
  isError: boolean;
}) {
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <WidgetCard title="Top customers">
        <Spinner label="Loading top customers…" />
      </WidgetCard>
    );
  }

  if (isError || !data) {
    return (
      <WidgetCard title="Top customers">
        <ErrorNote>Couldn&apos;t load top customers.</ErrorNote>
      </WidgetCard>
    );
  }

  if (data.customers.length === 0) {
    return (
      <WidgetCard title="Top customers" subtitle="billed revenue">
        <div className="flex-1 rounded-xl border border-dashed border-stone-300 p-4 text-center text-sm text-stone-400">
          No billed revenue to show.
        </div>
      </WidgetCard>
    );
  }

  // The backend already ranks and limits (ORDER BY revenue DESC LIMIT N) --
  // customers[0] is the top value, used only to scale the bar widths here.
  const maxValue = data.customers[0].value;
  const shownValue = data.customers.reduce((sum, c) => sum + c.value, 0);
  const concentrationPct = data.totalValue > 0 ? Math.round((shownValue / data.totalValue) * 100) : 0;

  return (
    <WidgetCard title="Top customers" subtitle="billed revenue">
      <div className="flex flex-col gap-[13px]">
        {data.customers.map((c, i) => {
          const proportion = maxValue > 0 ? c.value / maxValue : 0;
          const delta = formatRevenueDelta(c.value, c.priorValue);
          // Rank i is included in the fallback key (not just c.name) so two
          // unlinked customers (id null) that happen to share a display name
          // -- e.g. same-named accounts in different regions -- don't
          // collide on key.
          return (
            <div key={c.id ?? `${c.name}-${i}`} className="flex items-center gap-2 sm:gap-[11px]">
              <span className="w-4 shrink-0 text-2xs font-bold text-stone-400 tabular-nums">{i + 1}</span>
              {c.id ? (
                <button
                  type="button"
                  onClick={() => navigate(`/crm/customer/${c.id}`)}
                  aria-label={`View customer ${c.name}`}
                  className="min-w-0 flex-1 truncate rounded text-left text-xs font-medium text-stone-950 hover:text-accent-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {c.name}
                </button>
              ) : (
                <span className="min-w-0 flex-1 truncate text-xs font-medium text-stone-950">{c.name}</span>
              )}
              <div className="h-[9px] w-12 shrink-0 overflow-hidden rounded-full bg-stone-100 sm:w-16 md:w-20 lg:w-28">
                <div className="h-full rounded-full bg-brand-dark" style={{ width: `${proportion * 100}%` }} />
              </div>
              <div className="w-[76px] shrink-0 text-right sm:w-24">
                <div className="text-xs font-bold text-stone-950 tabular-nums">{currency(c.value)}</div>
                {delta && <div className={cn('text-2xs font-semibold', DELTA_TONE_CLASS[delta.tone])}>{delta.text}</div>}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-2xs text-stone-500">
        Top {data.customers.length} · {concentrationPct}% of revenue
      </p>
      <MoreHint count={data.customerCount - data.customers.length} label="more customers" />
    </WidgetCard>
  );
}
