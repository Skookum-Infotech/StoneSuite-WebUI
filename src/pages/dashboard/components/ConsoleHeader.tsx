import { useState } from 'react';
import { Download, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';

const RANGES = ['7d', '30d', 'Quarter'] as const;
type Range = (typeof RANGES)[number];

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
  onDownloadCsv,
  onCustomize,
}: {
  onDownloadCsv: () => void;
  onCustomize: () => void;
}) {
  const [range, setRange] = useState<Range>('30d');
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
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={range === r}
              onClick={() => setRange(r)}
              className={cn(
                'rounded-md px-[13px] py-1.5 text-xs font-semibold transition-colors',
                range === r ? 'bg-card text-stone-950 shadow-sm' : 'text-stone-500 hover:text-stone-700',
              )}
            >
              {r}
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
