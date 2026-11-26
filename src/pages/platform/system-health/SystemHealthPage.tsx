import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { PageHeader, Spinner, ErrorNote } from '@/components/tenant/ui';
import { getSystemHealth } from '@/services/platformSystemHealthService';
import { formatAge, isStale } from '@/lib/systemHealth';
import { ProblemsCard } from './components/ProblemsCard';
import { DatabasesCard } from './components/DatabasesCard';
import { AppsCard } from './components/AppsCard';
import { SitesCard } from './components/SitesCard';

const QUERY_KEY = ['platform-system-health'];

// Platform-admin view of the hourly watchdog snapshot: limits, crashes, awake
// time and website checks for every environment. The watchdog also emails the
// team, which is what still works when the app itself is down.
export default function SystemHealthPage() {
  const q = useQuery({ queryKey: QUERY_KEY, queryFn: getSystemHealth });
  // Ages are measured from when this data was fetched (refetched on focus),
  // which keeps render pure.
  const nowMs = q.dataUpdatedAt;
  const snapshot = q.data?.snapshot ?? null;

  return (
    <div className="p-6 3xl:p-10 4xl:p-14">
      <PageHeader
        title="System Health"
        subtitle="Usage limits, crashes and uptime for every environment, checked hourly without waking the servers."
      />

      {q.isLoading ? (
        <Spinner label="Loading system health…" />
      ) : q.error ? (
        <ErrorNote>{apiErrorMessage(q.error, 'Failed to load system health.')}</ErrorNote>
      ) : !snapshot ? (
        <div className="flex max-w-2xl items-start gap-3 rounded-[10px] border border-stone-200 bg-white p-5 text-sm text-stone-600 dark:border-stone-800 dark:bg-stone-900 dark:text-stone-300">
          <Activity className="mt-0.5 size-4 shrink-0 text-stone-400" aria-hidden="true" />
          <p>{q.data?.message ?? 'No health check has run yet.'}</p>
        </div>
      ) : (
        <div className="space-y-5">
          <p className="text-xs text-stone-500">
            Last checked {formatAge(snapshot.checkedAt, nowMs)} ({new Date(snapshot.checkedAt).toLocaleString()}).
          </p>
          {isStale(snapshot, nowMs) && (
            <div role="alert" className="flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-xs text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              <span>
                The watchdog has not reported for over two hours, so these numbers are old and alerts may not be going out.
                Check the stonesuite-watchdog Worker in the Cloudflare dashboard.
              </span>
            </div>
          )}
          <ProblemsCard problems={snapshot.problems} />
          <DatabasesCard databases={snapshot.databases} nowMs={nowMs} />
          <AppsCard apps={snapshot.apps} />
          <SitesCard sites={snapshot.sites} />
        </div>
      )}
    </div>
  );
}
