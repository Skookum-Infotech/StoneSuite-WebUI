import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, Search, ChevronLeft } from "lucide-react";
import { userService } from "@/services/tenantServices";
import { dashboardWidgetService } from "@/services/dashboardWidgetService";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, EmptyState, Badge } from "@/components/tenant/ui";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { initials, avatarColor } from "@/pages/config/users/userHelpers";
import { WIDGET_CATEGORY_ORDER, WIDGET_CATEGORY_LABELS } from "@/config/dashboardWidgets";
import type { WidgetDefinition } from "@/types/dashboardWidgets";

export default function DashboardWidgetsPage() {
  const [search, setSearch] = useState("");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const usersQ = useQuery({ queryKey: ["users"], queryFn: userService.listUsers });
  const catalogQ = useQuery({
    queryKey: ["dashboard-widget-catalog"],
    queryFn: dashboardWidgetService.getCatalog,
  });

  const users = useMemo(
    () => (usersQ.data ?? []).map((u) => ({ ...u, roles: u.roles ?? [] })),
    [usersQ.data],
  );
  const activeUser = users.find((u) => u.id === selectedUserId) ?? users[0] ?? null;

  // Widget settings are keyed by identity id, not the tenant-scoped
  // WorkspaceUser.id — the dashboard reads useAuthStore().user.id, which the
  // login response sets to the identity id (controllers/tenant.go's
  // TenantLogin returns `"id": identity.ID`). WorkspaceUser.id is a
  // different, tenant-membership id; WorkspaceUser.identityId is the one
  // that actually matches what the logged-in user sees on their own
  // dashboard.
  const activeIdentityId = activeUser?.identityId;

  const settingsQ = useQuery({
    queryKey: ["dashboard-widget-settings", activeIdentityId],
    queryFn: () => dashboardWidgetService.getSettings(activeIdentityId as string),
    enabled: Boolean(activeIdentityId),
  });

  const allocationMutation = useMutation({
    mutationFn: (widgetIds: string[]) =>
      dashboardWidgetService.setAllocation(activeIdentityId as string, widgetIds),
    onSuccess: (updated) => {
      queryClient.setQueryData(["dashboard-widget-settings", activeIdentityId], updated);
    },
  });

  const filteredUsers = users.filter((u) =>
    (u.fullName || u.email).toLowerCase().includes(search.toLowerCase()),
  );

  const catalog: WidgetDefinition[] = catalogQ.data ?? [];
  const settings = settingsQ.data;

  function handleToggleAllocation(widgetId: string, next: boolean) {
    if (!settings) return;
    const nextAllocated = next
      ? [...settings.allocated, widgetId]
      : settings.allocated.filter((id) => id !== widgetId);
    allocationMutation.mutate(nextAllocated);
  }

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background">
      <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
          <LayoutGrid className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Dashboard Widgets</h1>
          <p className="text-sm text-stone-500">Choose which dashboard widgets each user can see.</p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
        <aside
          className={cn(
            "flex flex-col md:w-64 md:shrink-0 md:border-r border-stone-100",
            activeUser ? "hidden md:flex" : "flex flex-1 md:flex-none",
          )}
        >
          <div className="border-b border-stone-100 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search users…"
                aria-label="Search users"
                className="w-full rounded-lg border border-stone-200 py-1.5 pl-8 pr-2.5 text-xs focus:border-brand-dark focus:outline-none"
              />
            </div>
          </div>

          <div className="flex-1 overflow-y-auto modal-scrollbar p-2 space-y-0.5">
            {usersQ.isLoading && <Spinner label="Loading users…" />}
            {usersQ.isError && (
              <p className="px-2 py-2 text-xs text-red-500">{apiErrorMessage(usersQ.error)}</p>
            )}
            {!usersQ.isLoading && filteredUsers.length === 0 && <EmptyState>No users found.</EmptyState>}
            {filteredUsers.map((u) => {
              const active = u.id === activeUser?.id;
              return (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => setSelectedUserId(u.id)}
                  aria-label={`Configure widgets for ${u.fullName || u.email}`}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "w-full rounded-lg px-2.5 py-2 text-left transition-colors border",
                    active ? "bg-brand/10 border-brand/25" : "border-transparent hover:bg-stone-50",
                  )}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div
                      className={cn(
                        "flex size-7 shrink-0 items-center justify-center rounded-lg text-2xs font-bold",
                        avatarColor(u.id),
                      )}
                    >
                      {initials(u.fullName || u.email)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className={cn(
                          "text-xs font-semibold truncate",
                          active ? "text-brand-dark" : "text-stone-700",
                        )}
                      >
                        {u.fullName || u.email}
                      </p>
                      <p className="text-2xs text-stone-400 truncate">
                        {u.roles.length === 0 ? "No roles" : u.roles.map((r) => r.name).join(", ")}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        <main
          className={cn(
            "flex-1 overflow-y-auto modal-scrollbar p-4 sm:p-6",
            !activeUser && "hidden md:block",
          )}
        >
          {activeUser && (
            <button
              type="button"
              onClick={() => setSelectedUserId(null)}
              className="md:hidden mb-3 flex items-center gap-1.5 text-xs font-semibold text-brand-dark"
            >
              <ChevronLeft className="size-3.5" />
              Back to users
            </button>
          )}

          {!activeUser && !usersQ.isLoading && (
            <div className="hidden md:flex h-full items-center justify-center">
              <div className="text-center">
                <LayoutGrid className="mx-auto mb-2 size-8 text-stone-300" />
                <p className="text-sm text-stone-400">Select a user to configure their dashboard widgets.</p>
              </div>
            </div>
          )}

          {activeUser && (
            <>
              <div className="mb-5 flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl text-xs font-bold",
                    avatarColor(activeUser.id),
                  )}
                >
                  {initials(activeUser.fullName || activeUser.email)}
                </div>
                <div>
                  <h2 className="text-sm font-bold text-stone-900">
                    {activeUser.fullName || activeUser.email}
                  </h2>
                  <p className="text-xs text-stone-500">{activeUser.email}</p>
                </div>
              </div>

              {settingsQ.isLoading && <Spinner label="Loading widget settings…" />}

              {settings && (
                <div className="space-y-6">
                  {WIDGET_CATEGORY_ORDER.map((category) => {
                    const widgets = catalog.filter((w) => w.category === category);
                    if (widgets.length === 0) return null;
                    return (
                      <div key={category}>
                        <h3 className="mb-2 text-2xs font-semibold uppercase tracking-[.09em] text-stone-500">
                          {WIDGET_CATEGORY_LABELS[category]}
                        </h3>
                        <div className="divide-y divide-stone-100 rounded-xl border border-stone-200">
                          {widgets.map((w) => {
                            const allocated = settings.allocated.includes(w.id);
                            const userEnabled = settings.enabled.includes(w.id);
                            return (
                              <label
                                key={w.id}
                                htmlFor={`allocate-${w.id}`}
                                className="flex cursor-pointer items-center justify-between gap-3 px-3 py-2.5"
                              >
                                <span className="min-w-0">
                                  <span className="block text-xs font-semibold text-stone-900">
                                    {w.title}
                                  </span>
                                  <span className="block text-2xs text-stone-500">{w.description}</span>
                                </span>
                                <span className="flex shrink-0 items-center gap-2.5">
                                  {allocated && (
                                    <Badge size="sm" color={userEnabled ? "#059669" : "#a8a29e"}>
                                      {userEnabled ? "Showing" : "Hidden by user"}
                                    </Badge>
                                  )}
                                  <Switch
                                    id={`allocate-${w.id}`}
                                    checked={allocated}
                                    onCheckedChange={(next) => handleToggleAllocation(w.id, next)}
                                    aria-label={`${allocated ? "Revoke" : "Grant"} ${w.title} for ${
                                      activeUser.fullName || activeUser.email
                                    }`}
                                  />
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
