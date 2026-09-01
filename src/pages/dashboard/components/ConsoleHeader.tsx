import { Download, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
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

export function ConsoleHeader({
  range,
  onRangeChange,
  onDownloadCsv,
  onCustomize,
}: {
  range: DashboardRange;
  onRangeChange: (range: DashboardRange) => void;
  onDownloadCsv: () => void;
  onCustomize: () => void;
}) {
  const fullName = useAuthStore((state) => state.user?.fullName);
  const firstName = fullName?.split(' ')[0];
  const greeting = getGreeting(new Date().getHours());

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-300 pb-[18px]">
      <div>
        <h1 className="text-[22px] font-bold tracking-[-0.015em] text-stone-950">
          {greeting}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="mt-[3px] text-[12.5px] text-stone-500">
          {TODAY_LABEL} &middot; all figures scoped to your active role
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div role="group" aria-label="Time range" className="inline-flex gap-0.5 rounded-lg bg-stone-100 p-[3px]">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={range === opt.value}
              onClick={() => onRangeChange(opt.value)}
              className={cn(
                'rounded-md px-[13px] py-1.5 text-xs font-semibold transition-colors',
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
          className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-card px-3.5 py-2 text-xs font-semibold text-stone-950 transition-colors hover:border-brand-dark hover:bg-accent"
        >
          <SlidersHorizontal className="size-3.5" />
          Customize
        </button>

        <button
          type="button"
          onClick={onDownloadCsv}
          aria-label="Download console data as CSV"
          className="flex items-center gap-1.5 rounded-lg border border-stone-300 bg-card px-3.5 py-2 text-xs font-semibold text-stone-950 transition-colors hover:border-brand-dark hover:bg-accent"
        >
          <Download className="size-3.5" />
          Download CSV
        </button>
      </div>
    </div>
  );
}
