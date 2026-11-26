import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { cn } from '@/lib/utils';
import { SEVERITY_DOT_CLASS, ruleLabel, sortAlerts } from '@/lib/usageWatchlist';
import { formatTenantDate } from '@/lib/tenantDisplay';
import type { UsageAlert } from '@/types/platformUsage';
import { AckAlertMenu } from './AckAlertMenu';
import { SeverityPill } from './SeverityPill';
import { usageDetailPath } from './usagePaths';

function WatchRow({ alert }: { alert: UsageAlert }) {
  const to = usageDetailPath(alert.tenantId);
  return (
    <li className="grid grid-cols-[4px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 border-t border-stone-100 py-2.5 first:border-t-0 md:grid-cols-[4px_88px_minmax(120px,180px)_minmax(0,1fr)_auto]">
      <span aria-hidden="true" className={cn('row-span-2 self-stretch rounded md:row-span-1', SEVERITY_DOT_CLASS[alert.severity])} />
      <span className="hidden md:block">
        <SeverityPill severity={alert.severity} />
      </span>
      <Link to={to} className="min-w-0 text-sm font-semibold text-stone-900 hover:underline">
        {alert.tenantName}
        <span className="block text-xs font-normal text-stone-500">
          <span className="md:hidden">{alert.severity} · </span>
          {ruleLabel(alert.ruleKey)} · since {formatTenantDate(alert.firstSeenAt)}
        </span>
      </Link>
      <div className="col-start-2 min-w-0 text-sm text-stone-800 md:col-start-auto">
        {alert.message}
        {alert.detail && <span className="block text-xs text-stone-500">{alert.detail}</span>}
      </div>
      <div className="col-start-3 row-span-2 row-start-1 flex items-center gap-1.5 md:col-start-auto md:row-span-1 md:row-start-auto">
        <Link
          to={to}
          aria-label={`View usage for ${alert.tenantName}`}
          className="rounded-lg border border-stone-300 bg-white px-2.5 py-1.5 text-label font-semibold text-stone-700 hover:bg-stone-50"
        >
          View
        </Link>
        <AckAlertMenu alert={alert} />
      </div>
    </li>
  );
}

/** Tenants with unusual or excessive usage, most severe first. */
export function WatchlistPanel({
  alerts,
  isLoading,
  error,
}: {
  alerts: UsageAlert[];
  isLoading: boolean;
  error: unknown;
}) {
  const sorted = sortAlerts(alerts);
  return (
    <section aria-labelledby="watchlist-heading" className="rounded-2xl border border-stone-200 bg-card p-4 sm:p-5">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="watchlist-heading" className="text-sm font-bold text-stone-950">
          Watch list{isLoading ? '' : ` (${sorted.length})`}
        </h2>
        <span className="text-xs text-stone-500">
          Tenants with unusual or excessive usage. Checked daily after the usage rollup.
        </span>
      </div>
      {isLoading && <Spinner label="Loading watch list…" />}
      {Boolean(error) &&<ErrorNote>{apiErrorMessage(error, 'Could not load the watch list.')}</ErrorNote>}
      {!isLoading && !error && sorted.length === 0 && (
        <p className="flex items-center gap-2 py-2 text-sm text-stone-500">
          <span className="flex size-5 items-center justify-center rounded-full bg-brand/20 text-brand-dark">
            <Check className="size-3" aria-hidden="true" />
          </span>
          All clear. No tenants need attention.
        </p>
      )}
      {sorted.length > 0 && (
        <ul aria-label="Alerts" className="flex flex-col">
          {sorted.map((a) => (
            <WatchRow key={a.id} alert={a} />
          ))}
        </ul>
      )}
    </section>
  );
}
