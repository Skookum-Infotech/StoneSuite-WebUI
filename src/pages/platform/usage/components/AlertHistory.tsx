import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatTenantDate } from '@/lib/tenantDisplay';
import { ruleLabel } from '@/lib/usageWatchlist';
import type { AlertStatus, UsageAlert } from '@/types/platformUsage';
import { SeverityPill } from './SeverityPill';

const STATUS_LABEL: Record<AlertStatus, string> = {
  open: 'Open',
  acked: 'Acknowledged',
  snoozed: 'Snoozed',
  resolved: 'Resolved automatically',
};

/** Every alert the tenant had in the last 90 days, newest first. */
export function AlertHistory({ alerts }: { alerts: UsageAlert[] }) {
  const sorted = [...alerts].sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt));
  return (
    <section aria-labelledby="history-heading" className="rounded-2xl border border-stone-200 bg-card p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="history-heading" className="text-sm font-bold text-stone-950">
          Alert history
        </h2>
        <span className="text-xs text-stone-500">Last 90 days</span>
      </div>
      {sorted.length === 0 ? (
        <p className="flex items-center gap-2 py-2 text-sm text-stone-500">
          <span className="flex size-5 items-center justify-center rounded-full bg-brand/20 text-brand-dark">
            <Check className="size-3" aria-hidden="true" />
          </span>
          No alerts in the last 90 days.
        </p>
      ) : (
        <ul className="flex flex-col">
          {sorted.map((a) => (
            <li
              key={a.id}
              className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 border-t border-stone-100 py-2 text-sm first:border-t-0 sm:grid-cols-[96px_120px_minmax(0,1fr)_auto]"
            >
              <span className="text-xs text-stone-500">{formatTenantDate(a.firstSeenAt)}</span>
              <SeverityPill severity={a.severity} label={ruleLabel(a.ruleKey)} />
              <span className="col-start-2 min-w-0 sm:col-start-auto">{a.message}</span>
              <span
                className={cn(
                  'col-start-2 text-xs sm:col-start-auto',
                  a.status === 'open' ? 'font-semibold text-red-600' : 'text-stone-500',
                )}
              >
                {STATUS_LABEL[a.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
