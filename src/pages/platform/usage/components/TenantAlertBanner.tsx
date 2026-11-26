import { cn } from '@/lib/utils';
import { formatTenantDate } from '@/lib/tenantDisplay';
import { ruleLabel, sortAlerts } from '@/lib/usageWatchlist';
import type { AlertSeverity, UsageAlert } from '@/types/platformUsage';
import { AckAlertMenu } from './AckAlertMenu';
import { SeverityPill } from './SeverityPill';

const BANNER_CLASS: Record<AlertSeverity, string> = {
  critical: 'border-red-200 bg-red-50/70 dark:border-red-900 dark:bg-red-950/30',
  warning: 'border-amber-200 bg-amber-50/70 dark:border-amber-900 dark:bg-amber-950/30',
  info: 'border-blue-200 bg-blue-50/70 dark:border-blue-900 dark:bg-blue-950/30',
};

/** The tenant's open alerts, each with its Ack / Snooze menu. */
export function TenantAlertBanner({ alerts }: { alerts: UsageAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <section aria-label="Open alerts" className="flex flex-col gap-2">
      {sortAlerts(alerts).map((a) => (
        <div
          key={a.id}
          role="alert"
          className={cn('flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3', BANNER_CLASS[a.severity])}
        >
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <SeverityPill severity={a.severity} />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-900">{a.message}</p>
              <p className="text-xs text-stone-500">
                {ruleLabel(a.ruleKey)} · since {formatTenantDate(a.firstSeenAt)}
                {a.detail ? ` · ${a.detail}` : ''}
              </p>
            </div>
          </div>
          <AckAlertMenu alert={a} />
        </div>
      ))}
    </section>
  );
}
