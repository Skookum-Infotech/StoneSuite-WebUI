import { useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid } from "lucide-react";
import { rbacService } from "@/services/tenantServices";
import { dashboardWidgetService } from "@/services/dashboardWidgetService";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, EmptyState } from "@/components/tenant/ui";
import { isSuperAdminGrants } from "@/lib/dashboardWidgets";
import { WIDGET_CATEGORY_ORDER, WIDGET_CATEGORY_LABELS } from "@/config/dashboardWidgets";
import type { RoleWidgetAllocation, WidgetDefinition } from "@/types/dashboardWidgets";
import { WidgetAllocationCard } from "./components/WidgetAllocationCard";

export default function DashboardWidgetsPage() {
  const queryClient = useQueryClient();

  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: rbacService.listRoles });
  const catalogQ = useQuery({
    queryKey: ["dashboard-widget-catalog"],
    queryFn: dashboardWidgetService.getCatalog,
  });

  // Super admin (wildcard-grant) roles are locked to every widget and aren't
  // editable here — same convention AccountSettingsPage uses to detect them.
  const roles = useMemo(
    () => (rolesQ.data ?? []).map((r) => ({ ...r, locked: isSuperAdminGrants(r.permissions) })),
    [rolesQ.data],
  );
  const roleIds = useMemo(() => roles.map((r) => r.id), [roles]);
  const editableRoleIds = useMemo(() => roles.filter((r) => !r.locked).map((r) => r.id), [roles]);

  const allocationsQ = useQuery({
    queryKey: ["dashboard-widget-role-allocations", roleIds],
    queryFn: () => dashboardWidgetService.getRoleAllocations(roleIds),
    enabled: roleIds.length > 0,
  });

  const allocations = useMemo(() => allocationsQ.data ?? [], [allocationsQ.data]);
  const catalog: WidgetDefinition[] = catalogQ.data ?? [];

  // widgetId -> ids of every role currently allocated that widget.
  const assignedRoleIdsByWidget = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const allocation of allocations) {
      for (const widgetId of allocation.allocated) {
        map.set(widgetId, [...(map.get(widgetId) ?? []), allocation.roleId]);
      }
    }
    return map;
  }, [allocations]);

  function mergeAllocations(updated: RoleWidgetAllocation[]): void {
    queryClient.setQueryData<RoleWidgetAllocation[]>(["dashboard-widget-role-allocations", roleIds], (prev) => {
      const byRole = new Map((prev ?? []).map((a) => [a.roleId, a]));
      for (const allocation of updated) byRole.set(allocation.roleId, allocation);
      return [...byRole.values()];
    });
  }

  const toggleMutation = useMutation({
    mutationFn: ({ roleId, widgetId, next }: { roleId: string; widgetId: string; next: boolean }) => {
      const current = allocations.find((a) => a.roleId === roleId)?.allocated ?? [];
      const nextAllocated = next ? [...current, widgetId] : current.filter((id) => id !== widgetId);
      return dashboardWidgetService.setRoleAllocation(roleId, nextAllocated);
    },
    onSuccess: (updated) => mergeAllocations([updated]),
  });

  // Assigns/clears one widget across every editable role in one action.
  const toggleAllMutation = useMutation({
    mutationFn: ({ widgetId, next }: { widgetId: string; next: boolean }) =>
      Promise.all(
        editableRoleIds.map((roleId) => {
          const current = allocations.find((a) => a.roleId === roleId)?.allocated ?? [];
          const nextAllocated = next ? [...current, widgetId] : current.filter((id) => id !== widgetId);
          return dashboardWidgetService.setRoleAllocation(roleId, nextAllocated);
        }),
      ),
    onSuccess: (updated) => mergeAllocations(updated),
  });

  function handleToggleRole(widgetId: string, roleId: string, next: boolean) {
    toggleMutation.mutate({ roleId, widgetId, next });
  }

  function handleToggleAll(widgetId: string, next: boolean) {
    toggleAllMutation.mutate({ widgetId, next });
  }

  const isLoading = rolesQ.isLoading || catalogQ.isLoading || allocationsQ.isLoading;

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background">
      <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
          <LayoutGrid className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Dashboard Widgets</h1>
          <p className="text-sm text-stone-500">
            Choose which roles can see each dashboard widget. Every user with a role sees what that
            role is allocated. Super admin roles always see everything.
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto modal-scrollbar p-4 sm:p-6">
        {isLoading && <Spinner label="Loading widget allocation…" />}

        {rolesQ.isError && <p className="text-xs text-red-500">{apiErrorMessage(rolesQ.error)}</p>}

        {!isLoading && roles.length === 0 && (
          <EmptyState>No roles found. Create a role before allocating widgets.</EmptyState>
        )}

        {!isLoading && roles.length > 0 && (
          <div className="space-y-6">
            {WIDGET_CATEGORY_ORDER.map((category) => {
              const widgets = catalog.filter((w) => w.category === category);
              if (widgets.length === 0) return null;
              return (
                <div key={category}>
                  <h3 className="mb-2 text-2xs font-semibold uppercase tracking-[.09em] text-stone-500">
                    {WIDGET_CATEGORY_LABELS[category]}
                  </h3>
                  <div className="space-y-2.5">
                    {widgets.map((w) => (
                      <WidgetAllocationCard
                        key={w.id}
                        widget={w}
                        roles={roles}
                        assignedRoleIds={assignedRoleIdsByWidget.get(w.id) ?? []}
                        onToggleRole={(roleId, next) => handleToggleRole(w.id, roleId, next)}
                        onToggleAll={(next) => handleToggleAll(w.id, next)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
