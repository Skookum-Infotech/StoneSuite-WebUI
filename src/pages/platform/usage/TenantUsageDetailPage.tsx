import { useEffect } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowUpRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { apiErrorMessage } from '@/api/tenantClient';
import { EmptyState, ErrorNote, Spinner } from '@/components/tenant/ui';
import { PLATFORM_USAGE_KEY } from '@/hooks/useAckUsageAlert';
import { useUsagePeriod } from '@/hooks/useUsagePeriod';
import { tenantDetailPath } from '@/lib/tenantDisplay';
import { buildUsageMetrics } from '@/lib/tenantUsageMetrics';
import { activeAlerts } from '@/lib/usageWatchlist';
import { PLATFORM_USAGE_MOCK, UsageNotAvailableError, platformUsageService } from '@/services/platformUsageService';
import { useAuthStore } from '@/store/useAuthStore';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { ActivityCard } from './components/ActivityCard';
import { AlertHistory } from './components/AlertHistory';
import { ComputeTrendChart } from './components/ComputeTrendChart';
import { PeriodToggle } from './components/PeriodToggle';
import { SampleDataNote } from './components/SampleDataNote';
import { StorageTrendChart } from './components/StorageTrendChart';
import { TenantAlertBanner } from './components/TenantAlertBanner';
import { TenantAvatar } from './components/TenantAvatar';
import { TopTablesCard } from './components/TopTablesCard';
import { UsageMetricCard } from './components/UsageMetricCard';
import { UsageStatus } from './components/UsageStatus';
import { USAGE_LIST_PATH } from './components/usagePaths';

const LINK_CLASS =
  'inline-flex items-center gap-1.5 rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 hover:bg-stone-50';

/** Platform › Tenant Usage › one tenant: metrics, trends, largest tables, activity and alerts. */
export default function TenantUsageDetailPage() {
  const { tenantId = '' } = useParams<{ tenantId: string }>();
  const user = useAuthStore((s) => s.user);
  const isAdmin = Boolean(user?.isPlatformAdmin);
  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  const [period, setPeriod] = useUsagePeriod();

  const detailQ = useQuery({
    queryKey: [PLATFORM_USAGE_KEY, 'tenant', tenantId, period],
    queryFn: () => platformUsageService.getTenantUsage(tenantId, period),
    enabled: isAdmin && tenantId !== '',
    retry: (count, err) => !(err instanceof UsageNotAvailableError) && count < 2,
  });
  const detail = detailQ.data;
  const name = detail?.tenant.displayName;

  // The breadcrumb shows the tenant's name, never the raw id segment.
  useEffect(() => {
    if (!name) return;
    setLabel(tenantId, name);
    return () => clearLabel(tenantId);
  }, [tenantId, name, setLabel, clearLabel]);

  if (user && !isAdmin) return <Navigate to="/dashboard" replace />;

  const open = detail ? activeAlerts(detail.alerts) : [];
  const unmeasured = detail !== undefined && detail.tenant.computeHours === null;

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <div className="space-y-5 p-6">
        <Link to={USAGE_LIST_PATH} className="inline-flex items-center gap-1 text-xs font-semibold text-stone-500 hover:text-stone-800">
          <ArrowLeft className="size-3.5" aria-hidden="true" /> Back to usage
        </Link>

        {PLATFORM_USAGE_MOCK && <SampleDataNote />}
        {detailQ.isLoading && <Spinner label="Loading tenant usage…" />}
        {detailQ.isError &&
          (detailQ.error instanceof UsageNotAvailableError ? (
            <EmptyState>Usage isn't available for this tenant.</EmptyState>
          ) : (
            <ErrorNote>{apiErrorMessage(detailQ.error, 'Could not load usage for this tenant.')}</ErrorNote>
          ))}

        {detail && (
          <>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <TenantAvatar name={detail.tenant.displayName} status={detail.tenant.status} large />
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold tracking-tight text-stone-900">{detail.tenant.displayName}</h1>
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <UsageStatus status={detail.tenant.status} />
                    <span className="font-mono text-label text-stone-500">{detail.tenant.slug}</span>
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <PeriodToggle value={period} onChange={setPeriod} />
                <Link to={tenantDetailPath(detail.tenant.tenantId)} className={LINK_CLASS} aria-label={`Open ${detail.tenant.displayName} customer settings`}>
                  Open customer <ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
              </div>
            </div>

            {unmeasured ? (
              <EmptyState>No usage yet. This tenant hasn't been provisioned, so nothing has been measured.</EmptyState>
            ) : (
              <>
                <TenantAlertBanner alerts={open} />
                <section aria-label="Key metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {buildUsageMetrics(detail, open).map((m) => (
                    <UsageMetricCard key={m.label} metric={m} />
                  ))}
                </section>
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <ComputeTrendChart series={detail.series} />
                  <StorageTrendChart series={detail.series} />
                  <TopTablesCard tables={detail.topTables} measuredAt={detail.topTablesMeasuredAt} />
                  <ActivityCard activity={detail.activity} period={detail.period} />
                </div>
                <AlertHistory alerts={detail.alerts} />
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
