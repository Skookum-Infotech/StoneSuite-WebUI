import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { LayoutGrid, LayoutList, Table2, Undo2 } from "lucide-react";
import { rbacService } from "@/services/tenantServices";
import { dashboardWidgetService } from "@/services/dashboardWidgetService";
import { apiErrorMessage } from "@/api/tenantClient";
import { Spinner, EmptyState } from "@/components/tenant/ui";
import { isSuperAdminGrants, dirtyRoleIds, toggleIds } from "@/lib/dashboardWidgets";
import { cn } from "@/lib/utils";
import type { RoleWidgetAllocation, WidgetDefinition } from "@/types/dashboardWidgets";
import { RoleRail } from "./components/RoleRail";
import { RoleWidgetPanel } from "./components/RoleWidgetPanel";
import { WidgetAllocationMatrix } from "./components/WidgetAllocationMatrix";
import { RoleColumnPicker } from "./components/RoleColumnPicker";

type ViewMode = "role" | "matrix";

// Below this many editable roles, the matrix just shows every column, same
// as before this existed. Past it, a role×widget grid stops being scannable
// regardless of layout, so the admin picks a subset to compare instead.
const MATRIX_AUTO_SHOW_THRESHOLD = 10;
const MATRIX_DEFAULT_VISIBLE_COUNT = 8;

// Local edits live here, keyed by roleId, until Save persists them. A role
// only appears once the admin actually changes something — everything else
// falls back to the persisted allocation, so dirtyRoleIds' equality check
// naturally drops an entry the admin toggled back to its original state.
type StagedAllocations = Record<string, string[]>;

export default function DashboardWidgetsPage() {
  const queryClient = useQueryClient();
  const [viewMode, setViewMode] = useState<ViewMode>("role");
  const [selectedRoleId, setSelectedRoleId] = useState<string>("");
  const [staged, setStaged] = useState<StagedAllocations>({});
  const [undoSnapshot, setUndoSnapshot] = useState<RoleWidgetAllocation[] | null>(null);
  // null = no explicit picker choice yet, so the matrix falls back to the
  // first MATRIX_DEFAULT_VISIBLE_COUNT editable roles.
  const [matrixVisibleRoleIds, setMatrixVisibleRoleIds] = useState<string[] | null>(null);

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
  const editableRoles = useMemo(() => roles.filter((r) => !r.locked), [roles]);

  const allocationsQ = useQuery({
    queryKey: ["dashboard-widget-role-allocations", roleIds],
    queryFn: () => dashboardWidgetService.getRoleAllocations(roleIds),
    enabled: roleIds.length > 0,
  });

  const allocations = useMemo(() => allocationsQ.data ?? [], [allocationsQ.data]);
  const catalog: WidgetDefinition[] = useMemo(() => catalogQ.data ?? [], [catalogQ.data]);
  const catalogIds = useMemo(() => catalog.map((w) => w.id), [catalog]);

  const originalAllocatedByRoleId = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const a of allocations) map[a.roleId] = a.allocated;
    return map;
  }, [allocations]);

  // What the admin currently sees/edits for every role — staged edit if any,
  // otherwise the persisted allocation, otherwise (locked roles) everything.
  const effectiveAllocatedByRole = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const role of roles) {
      map[role.id] = role.locked ? catalogIds : staged[role.id] ?? originalAllocatedByRoleId[role.id] ?? [];
    }
    return map;
  }, [roles, staged, originalAllocatedByRoleId, catalogIds]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const role of roles) map[role.id] = effectiveAllocatedByRole[role.id]?.length ?? 0;
    return map;
  }, [roles, effectiveAllocatedByRole]);

  const dirty = useMemo(() => dirtyRoleIds(staged, allocations), [staged, allocations]);

  const matrixNeedsPicker = editableRoles.length > MATRIX_AUTO_SHOW_THRESHOLD;
  const matrixVisibleIds = useMemo(() => {
    if (!matrixNeedsPicker) return editableRoles.map((r) => r.id);
    if (matrixVisibleRoleIds) return matrixVisibleRoleIds;
    return editableRoles.slice(0, MATRIX_DEFAULT_VISIBLE_COUNT).map((r) => r.id);
  }, [matrixNeedsPicker, matrixVisibleRoleIds, editableRoles]);
  // What the matrix actually renders as columns — locked roles always show
  // (there are typically only one or two), narrowed to the chosen editable
  // subset once the picker is in play.
  const matrixRoles = useMemo(() => {
    const visible = new Set(matrixVisibleIds);
    return roles.filter((r) => r.locked || visible.has(r.id));
  }, [roles, matrixVisibleIds]);

  // Derived rather than defaulted via effect — falls back to the first role
  // until the admin explicitly picks one, with no synchronous setState needed.
  const selectedRole = roles.find((r) => r.id === selectedRoleId) ?? roles[0];

  useEffect(() => {
    if (!undoSnapshot) return;
    const t = setTimeout(() => setUndoSnapshot(null), 8000);
    return () => clearTimeout(t);
  }, [undoSnapshot]);

  function mergeAllocations(updated: RoleWidgetAllocation[]): void {
    queryClient.setQueryData<RoleWidgetAllocation[]>(["dashboard-widget-role-allocations", roleIds], (prev) => {
      const byRole = new Map((prev ?? []).map((a) => [a.roleId, a]));
      for (const allocation of updated) byRole.set(allocation.roleId, allocation);
      return [...byRole.values()];
    });
  }

  function setRoleAllocation(roleId: string, nextIds: string[]) {
    setStaged((prev) => ({ ...prev, [roleId]: nextIds }));
  }

  function handleCopyFrom(targetRoleId: string, sourceRoleId: string) {
    setRoleAllocation(targetRoleId, [...(effectiveAllocatedByRole[sourceRoleId] ?? [])]);
  }

  function handleToggleCell(roleId: string, widgetId: string, next: boolean) {
    setRoleAllocation(roleId, toggleIds(effectiveAllocatedByRole[roleId] ?? [], [widgetId], next));
  }

  // Scoped to the roles the matrix currently shows, not every role in the
  // tenant — otherwise the "all on" state the toggle reads (also computed
  // from the visible set) could silently bulk-edit roles the admin can't
  // currently see and hasn't verified.
  function handleToggleWidgetForAllRoles(widgetId: string, next: boolean) {
    const visibleEditableRoles = matrixRoles.filter((r) => !r.locked);
    setStaged((prev) => {
      const updated = { ...prev };
      for (const role of visibleEditableRoles) {
        const current = prev[role.id] ?? originalAllocatedByRoleId[role.id] ?? [];
        updated[role.id] = toggleIds(current, [widgetId], next);
      }
      return updated;
    });
  }

  function handleToggleCategoryForRole(roleId: string, widgetIds: string[], next: boolean) {
    setRoleAllocation(roleId, toggleIds(effectiveAllocatedByRole[roleId] ?? [], widgetIds, next));
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const snapshot = dirty.map((roleId) => ({
        roleId,
        allocated: originalAllocatedByRoleId[roleId] ?? [],
      }));
      const results = await Promise.all(
        dirty.map((roleId) => dashboardWidgetService.setRoleAllocation(roleId, staged[roleId])),
      );
      return { results, snapshot };
    },
    onSuccess: ({ results, snapshot }) => {
      mergeAllocations(results);
      setStaged({});
      setUndoSnapshot(snapshot);
    },
  });

  const undoMutation = useMutation({
    mutationFn: (snapshot: RoleWidgetAllocation[]) =>
      Promise.all(snapshot.map((a) => dashboardWidgetService.setRoleAllocation(a.roleId, a.allocated))),
    onSuccess: (results) => {
      mergeAllocations(results);
      setUndoSnapshot(null);
    },
  });

  const isLoading = rolesQ.isLoading || catalogQ.isLoading || allocationsQ.isLoading;

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
            <LayoutGrid className="size-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-stone-900">Dashboard Widgets</h1>
            <p className="text-sm text-stone-500">
              Choose which roles can see each dashboard widget. Super admin roles always see everything.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-stone-200 p-0.5">
            <button
              type="button"
              onClick={() => setViewMode("role")}
              aria-pressed={viewMode === "role"}
              aria-label="Role view"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                viewMode === "role" ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100",
              )}
            >
              <LayoutList className="size-3.5" aria-hidden="true" />
              Role view
            </button>
            <button
              type="button"
              onClick={() => setViewMode("matrix")}
              aria-pressed={viewMode === "matrix"}
              aria-label="Matrix view"
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition-colors",
                viewMode === "matrix" ? "bg-stone-900 text-white" : "text-stone-500 hover:bg-stone-100",
              )}
            >
              <Table2 className="size-3.5" aria-hidden="true" />
              Matrix view
            </button>
          </div>

          {dirty.length > 0 && (
            <>
              <span className="text-xs font-medium text-stone-500">
                {dirty.length} unsaved change{dirty.length !== 1 ? "s" : ""}
              </span>
              <button
                type="button"
                onClick={() => setStaged({})}
                className="rounded-md px-2.5 py-1.5 text-xs font-semibold text-stone-500 hover:bg-stone-100"
              >
                Discard
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => saveMutation.mutate()}
            disabled={dirty.length === 0 || saveMutation.isPending}
            aria-label="Save widget allocation changes"
            className="rounded-md bg-brand-dark px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-stone-800 disabled:pointer-events-none disabled:opacity-40"
          >
            {saveMutation.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      {undoSnapshot && (
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 bg-brand/10 px-4 py-2 sm:px-6">
          <p className="text-xs font-medium text-brand-dark">
            Saved changes to {undoSnapshot.length} role{undoSnapshot.length !== 1 ? "s" : ""}.
          </p>
          <button
            type="button"
            onClick={() => undoMutation.mutate(undoSnapshot)}
            disabled={undoMutation.isPending}
            className="flex items-center gap-1 text-xs font-semibold text-brand-dark hover:underline disabled:pointer-events-none disabled:opacity-40"
          >
            <Undo2 className="size-3" aria-hidden="true" />
            Undo
          </button>
        </div>
      )}

      {saveMutation.isError && (
        <div className="border-b border-stone-100 px-4 py-2 sm:px-6">
          <p className="text-xs text-red-500">{apiErrorMessage(saveMutation.error)}</p>
        </div>
      )}

      <div className="flex-1 overflow-y-auto modal-scrollbar p-4 sm:p-6">
        {isLoading && <Spinner label="Loading widget allocation…" />}

        {rolesQ.isError && <p className="text-xs text-red-500">{apiErrorMessage(rolesQ.error)}</p>}

        {!isLoading && roles.length === 0 && (
          <EmptyState>No roles found. Create a role before allocating widgets.</EmptyState>
        )}

        {!isLoading && roles.length > 0 && viewMode === "role" && (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_1fr]">
            <aside className="lg:sticky lg:top-6 lg:self-start">
              <RoleRail
                roles={roles}
                selectedRoleId={selectedRole?.id ?? ""}
                onSelectRole={setSelectedRoleId}
                counts={counts}
                totalCount={catalog.length}
                dirtyRoleIds={dirty}
              />
            </aside>
            <section className="min-w-0">
              {selectedRole && (
                <RoleWidgetPanel
                  role={selectedRole}
                  catalog={catalog}
                  allocatedIds={effectiveAllocatedByRole[selectedRole.id] ?? []}
                  otherEditableRoles={editableRoles
                    .filter((r) => r.id !== selectedRole.id)
                    .map((r) => ({ id: r.id, name: r.name }))}
                  onChange={(nextIds) => setRoleAllocation(selectedRole.id, nextIds)}
                  onCopyFrom={(sourceRoleId) => handleCopyFrom(selectedRole.id, sourceRoleId)}
                />
              )}
            </section>
          </div>
        )}

        {!isLoading && roles.length > 0 && viewMode === "matrix" && (
          <div className="space-y-4">
            {matrixNeedsPicker && (
              <RoleColumnPicker
                roles={editableRoles.map((r) => ({ id: r.id, name: r.name }))}
                selectedIds={matrixVisibleIds}
                onChange={setMatrixVisibleRoleIds}
                onReset={() => setMatrixVisibleRoleIds(null)}
              />
            )}
            <WidgetAllocationMatrix
              catalog={catalog}
              roles={matrixRoles}
              allocatedIdsByRole={effectiveAllocatedByRole}
              onToggleCell={handleToggleCell}
              onToggleWidgetForAllRoles={handleToggleWidgetForAllRoles}
              onToggleCategoryForRole={handleToggleCategoryForRole}
            />
          </div>
        )}
      </div>
    </div>
  );
}
