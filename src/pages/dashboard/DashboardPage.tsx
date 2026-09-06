import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { buildCsvFilename, buildCsvText, downloadCsv } from '@/lib/csvExport';
import { recentRecordsToCsvRows } from '@/lib/recentRecordsCsv';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import { dashboardWidgetService } from '@/services/dashboardWidgetService';
import { dashboardDataService } from '@/services/dashboardDataService';
import { getVisibleWidgetIds } from '@/lib/dashboardWidgets';
import { Spinner, EmptyState } from '@/components/tenant/ui';
import type { WidgetDefinition, WidgetSize } from '@/types/dashboardWidgets';
import type { DashboardRange, RecentRecord } from '@/types/dashboardData';
import { ConsoleHeader } from './components/ConsoleHeader';
import { CustomizePanel } from './components/CustomizePanel';
import { KpiStrip } from './components/KpiStrip';
import { PipelineDonut } from './components/PipelineDonut';
import { MaterialConsumption } from './components/MaterialConsumption';
import { RecentRecordsTable } from './components/RecentRecordsTable';
import { SalesOrdersSnapshot } from './components/SalesOrdersSnapshot';
import { TopCustomers } from './components/TopCustomers';
import { InventoryAlerts } from './components/InventoryAlerts';
import { PurchasesStatus } from './components/PurchasesStatus';
import { ArOutstanding } from './components/ArOutstanding';
import { AccountingSnapshot } from './components/AccountingSnapshot';

// Widgets go full-width on phones, pair up from `md` (tablet / small laptop),
// and thirds get their own row of three only once there's `xl` room for it.
const SIZE_CLASS: Record<WidgetSize, string> = {
  full: 'col-span-12',
  half: 'col-span-12 md:col-span-6',
  third: 'col-span-12 md:col-span-6 xl:col-span-4',
};

// Widget data quietly refreshes on this cadence and on tab refocus, so the
// console reflects "right now" without a manual reload. Overrides the app-wide
// queryClient defaults (staleTime 2m, refetchOnWindowFocus off) for the
// dashboard only.
const DASHBOARD_REFRESH_MS = 90_000;
const LIVE_QUERY_OPTIONS = { refetchInterval: DASHBOARD_REFRESH_MS, refetchOnWindowFocus: true } as const;

// Widgets fade+rise in on load, lightly staggered by grid order. Capped so a
// long widget list doesn't leave the last card visibly lagging.
const ENTRANCE_ANIM =
  'motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 motion-safe:[animation-fill-mode:both]';
const STAGGER_STEP_MS = 45;
const MAX_STAGGER_STEPS = 6;

// Dashboard data queries share the 'dashboard-' key prefix but not the
// 'dashboard-widget-' one (allocation/preference/catalog), so a manual refresh
// re-fetches the data without disturbing the layout config.
function isDashboardDataKey(key: unknown): boolean {
  return typeof key === 'string' && key.startsWith('dashboard-') && !key.startsWith('dashboard-widget-');
}

// Exports the Recent records widget's currently-loaded rows -- the same
// bounded feed shown on screen, not a full unpaginated history (that's what
// exportPagedCsv is for on a list page; this is a console-level "download
// what you see" button). Empty when the widget isn't visible/loaded yet, or
// has nothing to show, rather than throwing.
function handleDownloadCsv(records: RecentRecord[]): void {
  const csv = buildCsvText(['Type', 'Record', 'Account', 'Value', 'Status', 'Updated'], recentRecordsToCsvRows(records));
  downloadCsv(buildCsvFilename('operations-console'), csv);
}

export default function DashboardPage() {
  const userId = useAuthStore((s) => s.user?.id);
  const queryClient = useQueryClient();
  const [showCustomize, setShowCustomize] = useState(false);
  // 'All time' default so the console opens on the true current shape of the
  // data, not a recent-activity window (see ConsoleHeader's RANGE_OPTIONS).
  const [range, setRange] = useState<DashboardRange>('all');

  const catalogQ = useQuery({
    queryKey: ['dashboard-widget-catalog'],
    queryFn: dashboardWidgetService.getCatalog,
  });
  // Resolved server-side from the caller's assigned role(s) (narrowed to the
  // active role if switched), or every widget if they hold a wildcard grant
  // — no client-side union or super-admin inference needed any more.
  const allocationQ = useQuery({
    queryKey: ['dashboard-widget-my-allocation'],
    queryFn: dashboardWidgetService.getMyAllocation,
  });
  const preferenceQ = useQuery({
    queryKey: ['dashboard-widget-preference', userId],
    queryFn: () => dashboardWidgetService.getPreference(userId as string),
    enabled: Boolean(userId),
  });

  const preferenceMutation = useMutation({
    mutationFn: (hiddenIds: string[]) => dashboardWidgetService.setPreference(userId as string, hiddenIds),
    onSuccess: (updated) => {
      queryClient.setQueryData(['dashboard-widget-preference', userId], updated);
    },
  });

  const preference = preferenceQ.data;
  const catalog: WidgetDefinition[] = catalogQ.data ?? [];
  const isLoading = catalogQ.isLoading || allocationQ.isLoading || preferenceQ.isLoading || !preference;

  const allocatedWidgetIds = allocationQ.data ?? [];
  const visibleWidgetIds = preference ? getVisibleWidgetIds(allocatedWidgetIds, preference.hidden) : [];
  const visibleWidgets = catalog.filter((w) => visibleWidgetIds.includes(w.id));
  const allocatedWidgets = catalog.filter((w) => allocatedWidgetIds.includes(w.id));

  // Only fetched when the widget is actually visible — no work done for a
  // user who doesn't have it allocated or has hidden it. All eight also
  // background-refresh on the dashboard cadence (see LIVE_QUERY_OPTIONS).
  const pipelineMixQ = useQuery({
    queryKey: ['dashboard-pipeline-mix', range],
    queryFn: () => dashboardDataService.getPipelineMix(range),
    enabled: visibleWidgetIds.includes('pipeline-donut'),
    ...LIVE_QUERY_OPTIONS,
  });
  const kpiStripQ = useQuery({
    queryKey: ['dashboard-kpi-strip', range],
    queryFn: () => dashboardDataService.getKpiStrip(range),
    enabled: visibleWidgetIds.includes('kpi-strip'),
    ...LIVE_QUERY_OPTIONS,
  });
  const recentRecordsQ = useQuery({
    queryKey: ['dashboard-recent-records', range],
    queryFn: () => dashboardDataService.getRecentRecords(range),
    enabled: visibleWidgetIds.includes('recent-records'),
    ...LIVE_QUERY_OPTIONS,
  });
  const salesOrdersSnapshotQ = useQuery({
    queryKey: ['dashboard-sales-orders-snapshot', range],
    queryFn: () => dashboardDataService.getSalesOrdersSnapshot(range),
    enabled: visibleWidgetIds.includes('sales-orders-snapshot'),
    ...LIVE_QUERY_OPTIONS,
  });
  const topCustomersQ = useQuery({
    queryKey: ['dashboard-top-customers', range],
    queryFn: () => dashboardDataService.getTopCustomers(range),
    enabled: visibleWidgetIds.includes('top-customers'),
    ...LIVE_QUERY_OPTIONS,
  });
  const inventoryAlertsQ = useQuery({
    queryKey: ['dashboard-inventory-alerts', range],
    queryFn: () => dashboardDataService.getInventoryAlerts(range),
    enabled: visibleWidgetIds.includes('inventory-alerts'),
    ...LIVE_QUERY_OPTIONS,
  });
  const purchasesStatusQ = useQuery({
    queryKey: ['dashboard-purchases-status', range],
    queryFn: () => dashboardDataService.getPurchasesStatus(range),
    enabled: visibleWidgetIds.includes('purchases-status'),
    ...LIVE_QUERY_OPTIONS,
  });
  const materialConsumptionQ = useQuery({
    queryKey: ['dashboard-material-consumption', range],
    queryFn: () => dashboardDataService.getMaterialConsumption(range),
    enabled: visibleWidgetIds.includes('material-consumption'),
    ...LIVE_QUERY_OPTIONS,
  });
  const arOutstandingQ = useQuery({
    queryKey: ['dashboard-ar-outstanding', range],
    queryFn: () => dashboardDataService.getArOutstanding(range),
    enabled: visibleWidgetIds.includes('ar-outstanding'),
    ...LIVE_QUERY_OPTIONS,
  });
  const accountingSnapshotQ = useQuery({
    queryKey: ['dashboard-accounting-snapshot', range],
    queryFn: () => dashboardDataService.getAccountingSnapshot(range),
    enabled: visibleWidgetIds.includes('accounting-snapshot'),
    ...LIVE_QUERY_OPTIONS,
  });

  // Freshness + manual refresh for the console header. dataUpdatedAt is 0 for a
  // query that hasn't resolved (or isn't enabled), so the max naturally tracks
  // the most recently refreshed visible widget.
  const dataQueries = [
    pipelineMixQ, kpiStripQ, recentRecordsQ, salesOrdersSnapshotQ,
    topCustomersQ, inventoryAlertsQ, purchasesStatusQ, materialConsumptionQ,
    arOutstandingQ, accountingSnapshotQ,
  ];
  const lastUpdatedAt = Math.max(0, ...dataQueries.map((q) => q.dataUpdatedAt)) || null;
  const isRefreshing = dataQueries.some((q) => q.isFetching);
  const handleRefresh = () => {
    void queryClient.invalidateQueries({ predicate: (q) => isDashboardDataKey(q.queryKey[0]) });
  };

  function renderWidget(w: WidgetDefinition): ReactNode {
    switch (w.id) {
      case 'pipeline-donut':
        return <PipelineDonut data={pipelineMixQ.data} isLoading={pipelineMixQ.isLoading} isError={pipelineMixQ.isError} />;
      case 'kpi-strip':
        return <KpiStrip metrics={kpiStripQ.data?.metrics} isLoading={kpiStripQ.isLoading} isError={kpiStripQ.isError} />;
      case 'recent-records':
        return (
          <RecentRecordsTable
            records={recentRecordsQ.data?.records}
            isLoading={recentRecordsQ.isLoading}
            isError={recentRecordsQ.isError}
            hasMore={recentRecordsQ.data?.hasMore}
          />
        );
      case 'sales-orders-snapshot':
        return (
          <SalesOrdersSnapshot
            data={salesOrdersSnapshotQ.data}
            isLoading={salesOrdersSnapshotQ.isLoading}
            isError={salesOrdersSnapshotQ.isError}
          />
        );
      case 'top-customers':
        return (
          <TopCustomers data={topCustomersQ.data} isLoading={topCustomersQ.isLoading} isError={topCustomersQ.isError} />
        );
      case 'inventory-alerts':
        return (
          <InventoryAlerts data={inventoryAlertsQ.data} isLoading={inventoryAlertsQ.isLoading} isError={inventoryAlertsQ.isError} />
        );
      case 'purchases-status':
        return (
          <PurchasesStatus data={purchasesStatusQ.data} isLoading={purchasesStatusQ.isLoading} isError={purchasesStatusQ.isError} />
        );
      case 'material-consumption':
        return (
          <MaterialConsumption
            data={materialConsumptionQ.data}
            isLoading={materialConsumptionQ.isLoading}
            isError={materialConsumptionQ.isError}
          />
        );
      case 'ar-outstanding':
        return (
          <ArOutstanding data={arOutstandingQ.data} isLoading={arOutstandingQ.isLoading} isError={arOutstandingQ.isError} />
        );
      case 'accounting-snapshot':
        return (
          <AccountingSnapshot
            data={accountingSnapshotQ.data}
            isLoading={accountingSnapshotQ.isLoading}
            isError={accountingSnapshotQ.isError}
          />
        );
      default:
        return null;
    }
  }

  function handleTogglePreference(widgetId: string, next: boolean) {
    if (!preference) return;
    const nextHidden = next
      ? preference.hidden.filter((id) => id !== widgetId) // next=true means "show"
      : [...preference.hidden, widgetId]; // next=false means "hide"
    preferenceMutation.mutate(nextHidden);
  }

  return (
    <div className="mx-auto w-full max-w-[1800px] flex-1 p-4 sm:p-6 3xl:p-10 4xl:p-14">
      <div className="flex flex-col gap-3.5">
        <ConsoleHeader
          range={range}
          onRangeChange={setRange}
          onDownloadCsv={() => handleDownloadCsv(recentRecordsQ.data?.records ?? [])}
          onCustomize={() => setShowCustomize(true)}
          refresh={{ updatedAt: lastUpdatedAt, isRefreshing, onRefresh: handleRefresh }}
        />

        {isLoading && <Spinner label="Loading dashboard…" />}

        {!isLoading && visibleWidgets.length === 0 && (
          <EmptyState>
            {allocatedWidgetIds.length === 0
              ? 'Ask your admin to allocate dashboard widgets to your role.'
              : 'All your widgets are hidden. Click Customize to turn some on.'}
          </EmptyState>
        )}

        {!isLoading && visibleWidgets.length > 0 && (
          <div className="grid grid-cols-12 gap-3.5">
            {visibleWidgets.map((w, i) => (
              <div
                key={w.id}
                className={cn(SIZE_CLASS[w.size], ENTRANCE_ANIM)}
                style={{ animationDelay: `${Math.min(i, MAX_STAGGER_STEPS) * STAGGER_STEP_MS}ms` }}
              >
                {renderWidget(w)}
              </div>
            ))}
          </div>
        )}
      </div>

      {showCustomize && preference && (
        <CustomizePanel
          widgets={allocatedWidgets}
          enabledIds={visibleWidgetIds}
          onToggle={handleTogglePreference}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </div>
  );
}
