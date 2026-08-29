import type { FeedbackStats } from '@/types/feedback';

// Status-count summary tiles atop the list — a quick read of the queue
// without having to apply each status filter in turn.
export function FeedbackStatsTiles({ stats }: { stats: FeedbackStats | undefined }) {
  const tiles: { label: string; value: number; accent: string }[] = [
    { label: 'New', value: stats?.new ?? 0, accent: 'text-sky-600 dark:text-sky-400' },
    { label: 'In Progress', value: stats?.inProgress ?? 0, accent: 'text-amber-600 dark:text-amber-400' },
    { label: 'Done', value: stats?.done ?? 0, accent: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Cancelled', value: stats?.cancelled ?? 0, accent: 'text-stone-500 dark:text-stone-400' },
    { label: 'Total', value: stats?.total ?? 0, accent: 'text-stone-900 dark:text-stone-100' },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {tiles.map((t) => (
        <div key={t.label} className="rounded-xl border border-stone-200 bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
          <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400">{t.label}</p>
          <p className={`mt-1 text-2xl font-bold tabular-nums ${t.accent}`}>{t.value}</p>
        </div>
      ))}
    </div>
  );
}
