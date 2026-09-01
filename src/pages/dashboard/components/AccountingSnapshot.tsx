import { cn } from '@/lib/utils';
import { WidgetCard } from './WidgetCard';
import { MoreHint } from './MoreHint';
import type { AccountingPeriodSummary, JournalEntrySummary } from '../mockData';

const LIMIT = 3;

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export function AccountingSnapshot({
  period,
  entries,
}: {
  period: AccountingPeriodSummary;
  entries: JournalEntrySummary[];
}) {
  const visible = entries.slice(0, LIMIT);

  return (
    <WidgetCard title="Accounting snapshot" subtitle={`${period.entryCount} entries this period`}>
      <div className="flex items-center justify-between rounded-xl bg-stone-50 p-3">
        <span className="text-xs font-semibold text-stone-950">{period.name}</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-2xs font-bold',
            period.status === 'open' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-200 text-stone-600',
          )}
        >
          {period.status === 'open' ? 'Open' : 'Closed'}
        </span>
      </div>

      <div className="mt-3 flex flex-col divide-y divide-stone-100">
        {visible.map((e) => (
          <div key={e.id} className="flex items-center justify-between gap-2.5 py-2 first:pt-0 last:pb-0">
            <div className="min-w-0">
              <div className="truncate text-xs font-semibold text-stone-950">{e.description}</div>
              <div className="font-mono text-2xs text-stone-500">{e.entryNumber}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-xs font-bold text-stone-950 tabular-nums">{currency(e.amount)}</div>
              <div className="text-2xs text-stone-500">{e.date}</div>
            </div>
          </div>
        ))}
      </div>
      <MoreHint count={entries.length - LIMIT} label="more entries" />
    </WidgetCard>
  );
}
