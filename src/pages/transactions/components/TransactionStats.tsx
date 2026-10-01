import { Clock, FilePlus, Layers, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { TransactionSummary } from '@/types/myTransactions';

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: string; sub: string; icon: React.ElementType; accent: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-2xl border border-stone-200 bg-white px-3 py-3 shadow-sm sm:gap-4 sm:px-5 sm:py-4">
      <div className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10', accent)}>
        <Icon className="size-4.5" />
      </div>
      <div className="min-w-0">
        {/* Wraps on a narrow phone (two cards per row), truncates once there is room to spare. */}
        <p className="text-xs font-semibold leading-tight text-stone-500 sm:truncate">{label}</p>
        <p className="mt-0.5 truncate text-base font-bold leading-tight text-stone-900 tabular-nums">{value}</p>
        {/* The caption is the first thing to go on a phone: two cards per row leave no room for it. */}
        <p className="mt-0.5 hidden truncate text-2xs text-stone-400 sm:block">{sub}</p>
      </div>
    </div>
  );
}

/**
 * The four stat cards over everything the caller may read: a 2×2 grid on
 * phones and tablets (four across at 768px would clip the labels), one row
 * from lg up. `summary` is null until it loads, when every value shows a dash.
 */
export function TransactionStats({ summary }: { summary: TransactionSummary | null }) {
  const n = (v: number | undefined): string => (v === undefined ? '—' : v.toLocaleString());
  return (
    <div className="grid grid-cols-2 gap-2 sm:gap-3 lg:grid-cols-4">
      <StatCard
        label="Total records"
        value={n(summary?.total)}
        sub="created or updated by you"
        icon={Layers}
        accent="bg-stone-100 text-stone-600"
      />
      <StatCard
        label="Created by me"
        value={n(summary?.created)}
        sub="records you started"
        icon={FilePlus}
        accent="bg-emerald-50 text-emerald-600"
      />
      <StatCard
        label="Updated by me"
        value={n(summary?.updated)}
        sub="others' records you last edited"
        icon={Pencil}
        accent="bg-sky-50 text-sky-600"
      />
      <StatCard
        label="Last 7 days"
        value={n(summary?.recent)}
        sub="touched recently"
        icon={Clock}
        accent="bg-amber-50 text-amber-600"
      />
    </div>
  );
}
