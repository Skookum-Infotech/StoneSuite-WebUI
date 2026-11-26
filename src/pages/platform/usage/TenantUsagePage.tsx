import { Navigate } from 'react-router-dom';
import { Gauge } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { PLATFORM_USAGE_KEY } from '@/hooks/useAckUsageAlert';
import { useUsagePeriod } from '@/hooks/useUsagePeriod';
import { formatTenantDateTime } from '@/lib/tenantDisplay';
import { PLATFORM_USAGE_MOCK, platformUsageService } from '@/services/platformUsageService';
import { useAuthStore } from '@/store/useAuthStore';
import { FleetKpiStrip } from './components/FleetKpiStrip';
import { PeriodToggle } from './components/PeriodToggle';
import { SampleDataNote } from './components/SampleDataNote';
import { TenantUsageTable } from './components/TenantUsageTable';
import { WatchlistPanel } from './components/WatchlistPanel';

/** Platform › Tenant Usage: fleet totals, the watch list and every tenant's usage. */
export default function TenantUsagePage() {
  const user = useAuthStore((s) => s.user);
  const isAdmin = Boolean(user?.isPlatformAdmin);
  const [period, setPeriod] = useUsagePeriod();

  const overviewQ = useQuery({
    queryKey: [PLATFORM_USAGE_KEY, 'overview', period],
    queryFn: () => platformUsageService.getOverview(period),
    enabled: isAdmin,
  });
  const watchQ = useQuery({
    queryKey: [PLATFORM_USAGE_KEY, 'watchlist'],
    queryFn: platformUsageService.getWatchlist,
    enabled: isAdmin,
  });

  if (user && !isAdmin) return <Navigate to="/dashboard" replace />;

  const alerts = watchQ.data ?? [];
  const overview = overviewQ.data;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="space-y-5 p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
              <Gauge className="size-6" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-stone-900">Tenant Usage</h1>
              <p className="text-sm text-stone-500">
                Resource usage across all tenants
                {overview ? ` · last updated ${formatTenantDateTime(overview.generatedAt)}` : ''}
              </p>
            </div>
          </div>
          <PeriodToggle value={period} onChange={setPeriod} />
        </div>

        {PLATFORM_USAGE_MOCK && <SampleDataNote />}

        {overviewQ.isLoading && <Spinner label="Loading usage…" />}
        {overviewQ.isError && <ErrorNote>{apiErrorMessage(overviewQ.error, 'Could not load tenant usage.')}</ErrorNote>}

        {overview && (
          <FleetKpiStrip
            fleet={overview.fleet}
            openAlerts={alerts.length}
            criticalAlerts={alerts.filter((a) => a.severity === 'critical').length}
          />
        )}

        <WatchlistPanel alerts={alerts} isLoading={watchQ.isLoading} error={watchQ.error} />

        {overview && <TenantUsageTable rows={overview.tenants} period={period} />}
      </div>
    </div>
  );
}
