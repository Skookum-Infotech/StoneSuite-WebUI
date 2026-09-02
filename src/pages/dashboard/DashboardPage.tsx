import { useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { buildCsvFilename, buildCsvText, downloadCsv } from '@/lib/csvExport';
import { useAuthStore } from '@/store/useAuthStore';
import { dashboardWidgetService } from '@/services/dashboardWidgetService';
import { dashboardDataService } from '@/services/dashboardDataService';
import { getVisibleWidgetIds } from '@/lib/dashboardWidgets';
import { Spinner, EmptyState } from '@/components/tenant/ui';
import type { WidgetDefinition, WidgetSize } from '@/types/dashboardWidgets';
import type { DashboardRange } from '@/types/dashboardData';
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
import {
  materialUsage,
  recentRecords,
  openSalesOrders,
  customerValues,
  inventoryAlerts,
  purchaseStatusItems,
  recentJournalEntries,
  currentAccountingPeriod,
  outstandingInvoices,
} from './mockData';

const SIZE_CLASS: Record<WidgetSize, string> = {
  full: 'col-span-12',
  half: 'col-span-12 lg:col-span-6',
  third: 'col-span-12 lg:col-span-4',
};

// Maps a catalog widget id to its rendered content. Add an entry here
// whenever a widget is added to src/config/dashboardWidgets.ts. Real-data
// widgets that need query state (pipeline-donut, kpi-strip) are rendered via
// renderWidget below instead of from this table, since their content
// depends on data resolved inside the component body.
const WIDGET_RENDERERS: Record<string, () => ReactNode> = {
  'material-consumption': () => <MaterialConsumption items={materialUsage} />,
  'recent-records': () => <RecentRecordsTable records={recentRecords} />,
  'sales-orders-snapshot': () => <SalesOrdersSnapshot orders={openSalesOrders} />,
  'top-customers': () => <TopCustomers customers={customerValues} />,
  'inventory-alerts': () => <InventoryAlerts alerts={inventoryAlerts} />,
  'purchases-status': () => <PurchasesStatus items={purchaseStatusItems} />,
  'ar-outstanding': () => <ArOutstanding invoices={outstandingInvoices} />,
  'accounting-snapshot': () => (
    <AccountingSnapshot period={currentAccountingPeriod} entries={recentJournalEntries} />
  ),
};

function handleDownloadCsv(): void {
  const csv = buildCsvText(
    ['Type', 'Record', 'Account', 'Value', 'Status', 'Updated'],
    recentRecords.map((r) => [
      r.type,
      r.recordNumber,
      r.account,
      r.value === null ? '' : String(r.value),
      r.status,
      r.updatedAt,
    ]),
  );
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
  // user who doesn't have it allocated or has hidden it.
  const pipelineMixQ = useQuery({
    queryKey: ['dashboard-pipeline-mix', range],
    queryFn: () => dashboardDataService.getPipelineMix(range),
    enabled: visibleWidgetIds.includes('pipeline-donut'),
  });
  const kpiStripQ = useQuery({
    queryKey: ['dashboard-kpi-strip', range],
    queryFn: () => dashboardDataService.getKpiStrip(range),
    enabled: visibleWidgetIds.includes('kpi-strip'),
  });

  function renderWidget(w: WidgetDefinition): ReactNode {
    switch (w.id) {
      case 'pipeline-donut':
        return <PipelineDonut data={pipelineMixQ.data} isLoading={pipelineMixQ.isLoading} isError={pipelineMixQ.isError} />;
      case 'kpi-strip':
        return <KpiStrip metrics={kpiStripQ.data?.metrics} isLoading={kpiStripQ.isLoading} isError={kpiStripQ.isError} />;
      default:
        return WIDGET_RENDERERS[w.id]?.();
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
    <div className="flex-1 p-4 sm:p-6 3xl:p-10 4xl:p-14">
      <div className="flex flex-col gap-3.5">
        <ConsoleHeader
          range={range}
          onRangeChange={setRange}
          onDownloadCsv={handleDownloadCsv}
          onCustomize={() => setShowCustomize(true)}
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
            {visibleWidgets.map((w) => (
              <div key={w.id} className={SIZE_CLASS[w.size]}>
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
