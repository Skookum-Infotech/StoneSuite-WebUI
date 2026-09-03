import { useEffect, useState } from 'react';
import { Download, RefreshCw, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { formatFreshness } from '@/lib/dashboardFreshness';
import type { DashboardRange } from '@/types/dashboardData';

// 'All time' first and default (see DashboardPage) so the console opens on
// the true current shape of the data, not a recent-activity window; the
// date-bounded options are an opt-in "new business in this window" lens.
const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: 'all', label: 'All time' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
  { value: 'quarter', label: 'Quarter' },
];

const MORNING_HOUR_END = 12;
const AFTERNOON_HOUR_END = 18;
const FRESHNESS_TICK_MS = 30_000;

function getGreeting(hour: number): string {
  if (hour < MORNING_HOUR_END) return 'Good morning';
  if (hour < AFTERNOON_HOUR_END) return 'Good afternoon';
  return 'Good evening';
}

const TODAY_LABEL = new Date().toLocaleDateString('en-US', {
  weekday: 'long',
  month: 'long',
  day: 'numeric',
});

export interface DashboardRefreshState {
  updatedAt: number | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export function ConsoleHeader({
  range,
  onRangeChange,
  onDownloadCsv,
  onCustomize,
  refresh,
}: {
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  onDownloadCsv: () => void;
  onCustomize: () => void;
  refresh: DashboardRefreshState;
}) {
  const fullName = useAuthStore((state) => state.user?.fullName);
  const firstName = fullName?.split(' ')[0];
  const greeting = getGreeting(new Date().getHours());

  // Re-render on a slow cadence so "Updated 2m ago" keeps counting up between
  // the 90s background refetches.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), FRESHNESS_TICK_MS);
    return () => clearInterval(id);
  }, []);
  const freshnessLabel = formatFreshness(refresh.updatedAt, refresh.isRefreshing, now);

  return (
    <div className="flex flex-col gap-3 border-b border-stone-300 pb-[18px] lg:flex-row lg:flex-wrap lg:items-center lg:justify-between">
      <div className="min-w-0">
        <h1 className="text-[20px] font-bold tracking-[-0.015em] text-stone-950 sm:text-[22px]">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-[3px] flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-stone-500">
          <span>{TODAY_LABEL}</span>
          <span aria-hidden="true">&middot;</span>
          <span>all figures scoped to your active role</span>
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={refresh.onRefresh}
          disabled={refresh.isRefreshing}
          aria-label="Refresh dashboard data"
          className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-700 disabled:cursor-default disabled:hover:bg-transparent"
        >
          <RefreshCw className={cn('size-3 shrink-0', refresh.isRefreshing && 'animate-spin motion-reduce:animate-none')} />
          <span className="tabular-nums">{freshnessLabel}</span>
        </button>

        <div
          role="group"
          aria-label="Time range"
          className="inline-flex shrink-0 gap-0.5 rounded-lg bg-stone-100 p-[3px]"
        >
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={range === opt.value}
              onClick={() => onRangeChange(opt.value)}
              className={cn(
                'rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors sm:px-[13px]',
                range === opt.value ? 'bg-card text-stone-950 shadow-sm' : 'text-stone-500 hover:text-stone-700',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={onCustomize}
          aria-label="Customize dashboard widgets"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-300 bg-card px-2.5 py-2 text-xs font-semibold text-stone-950 transition-colors hover:border-brand-dark hover:bg-accent sm:px-3.5"
        >
          <SlidersHorizontal className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">Customize</span>
        </button>

        <button
          type="button"
          onClick={onDownloadCsv}
          aria-label="Download console data as CSV"
          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-stone-300 bg-card px-2.5 py-2 text-xs font-semibold text-stone-950 transition-colors hover:border-brand-dark hover:bg-accent sm:px-3.5"
        >
          <Download className="size-3.5 shrink-0" />
          <span className="hidden sm:inline">Download CSV</span>
        </button>
      </div>
    </div>
  );
}
