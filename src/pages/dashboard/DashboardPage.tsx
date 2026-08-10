import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { buildCsvFilename, buildCsvText, downloadCsv } from '@/lib/csvExport';
import { useAuthStore } from '@/store/useAuthStore';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { dashboardWidgetService } from '@/services/dashboardWidgetService';
import { getAllocatedWidgetIds, getVisibleWidgetIds, isSuperAdminGrants } from '@/lib/dashboardWidgets';
import { Spinner, EmptyState } from '@/components/tenant/ui';
import type { WidgetDefinition, WidgetSize } from '@/types/dashboardWidgets';
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
  kpiMetrics,
  pipelineSegments,
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
// whenever a widget is added to src/config/dashboardWidgets.ts.
const WIDGET_RENDERERS: Record<string, () => ReactNode> = {
  'kpi-strip': () => <KpiStrip metrics={kpiMetrics} />,
  'pipeline-donut': () => <PipelineDonut segments={pipelineSegments} />,
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
  const userRoles = useAuthStore((s) => s.user?.roles);
  const { activeRoleId, grants } = useUserPermissions();
  const isSuperAdmin = isSuperAdminGrants(grants);
  const queryClient = useQueryClient();
  const [showCustomize, setShowCustomize] = useState(false);

  const userRoleIds = useMemo(() => (userRoles ?? []).map((r) => r.id), [userRoles]);

  const catalogQ = useQuery({
    queryKey: ['dashboard-widget-catalog'],
    queryFn: dashboardWidgetService.getCatalog,
  });
  const allocationsQ = useQuery({
    queryKey: ['dashboard-widget-role-allocations', userRoleIds],
    queryFn: () => dashboardWidgetService.getRoleAllocations(userRoleIds),
    enabled: userRoleIds.length > 0,
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
  const isLoading = catalogQ.isLoading || allocationsQ.isLoading || preferenceQ.isLoading || !preference;

  // Super admin's allocation is locked to every widget — not editable from
  // the admin screen — so their dashboard always has the full catalog available.
  const allocatedWidgetIds = isSuperAdmin
    ? catalog.map((w) => w.id)
    : getAllocatedWidgetIds(allocationsQ.data ?? [], userRoleIds, activeRoleId);
  const visibleWidgetIds = preference ? getVisibleWidgetIds(allocatedWidgetIds, preference.hidden) : [];
  const visibleWidgets = catalog.filter((w) => visibleWidgetIds.includes(w.id));
  const allocatedWidgets = catalog.filter((w) => allocatedWidgetIds.includes(w.id));

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
        <ConsoleHeader onDownloadCsv={handleDownloadCsv} onCustomize={() => setShowCustomize(true)} />

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
                {WIDGET_RENDERERS[w.id]?.()}
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
