import type { TenantActivity, UsagePeriod } from '@/types/platformUsage';
import { UsageBar } from './UsageBar';

const PERIOD_LABEL: Record<UsagePeriod, string> = { '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 90 days' };

/** What the tenant did with the platform this period: records created, emails, automations. */
export function ActivityCard({ activity, period }: { activity: TenantActivity; period: UsagePeriod }) {
  const modules = [...activity.recordsByModule].sort((a, b) => b.count - a.count);
  const total = modules.reduce((acc, m) => acc + m.count, 0);
  const largest = modules[0]?.count ?? 0;
  const fmt = (n: number) => n.toLocaleString('en-US');

  return (
    <section aria-labelledby="activity-heading" className="min-w-0 rounded-2xl border border-stone-200 bg-card p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="activity-heading" className="text-sm font-bold text-stone-950">
          Activity
        </h2>
        <span className="text-xs text-stone-500">
          {PERIOD_LABEL[period]} · {fmt(total)} records created
        </span>
      </div>
      <ul className="flex flex-col">
        {modules.map((m) => (
          <li key={m.label} className="flex flex-col gap-1.5 border-t border-stone-100 py-2 first:border-t-0">
            <span className="flex justify-between gap-3 text-sm">
              <span>{m.label}</span>
              <span className="tabular-nums">{fmt(m.count)}</span>
            </span>
            <UsageBar value={m.count} max={largest} label={`${m.label} created`} tone="teal" />
          </li>
        ))}
        <li className="flex justify-between gap-3 border-t border-stone-100 py-2 text-sm">
          <span>Emails sent</span>
          <span className="tabular-nums">{fmt(activity.emailsSent)}</span>
        </li>
        <li className="flex justify-between gap-3 border-t border-stone-100 py-2 text-sm">
          <span>Automation runs</span>
          <span className="tabular-nums">{fmt(activity.automationRuns)}</span>
        </li>
      </ul>
    </section>
  );
}
