import React, { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Trash2,
  Lock,
  ShieldCheck,
  Check,
  Pencil,
  Users,
  UserPlus,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { rbacService, userService } from "@/services/tenantServices";
import { apiErrorMessage } from "@/api/tenantClient";
import { Badge, ErrorNote, EmptyState } from "@/components/tenant/ui";
import { sidebarNav } from "@/config/sidebarNav";
import { cn } from "@/lib/utils";
import { SCOPE_LABELS } from "@/lib/scope";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import type { Role, Scope, WorkspaceUser } from "@/types/tenant";
import { AssignUsersModal } from "./components/AssignUsersModal";

// ---------------------------------------------------------------------------

const ACTION_ORDER = [
  "read",
  "create",
  "update",
  "delete",
  "transition",
  "configure",
];

const ACTION_LABELS: Record<string, string> = {
  read: "Read",
  create: "Create",
  update: "Edit",
  delete: "Delete",
  transition: "Transition",
  configure: "Configure",
};

interface ResourceRow {
  id: string;
  resource: string;
  label: string;
}
interface PermModule {
  id: string;
  label: string;
  icon: LucideIcon;
  rows: ResourceRow[];
}

function buildPermModules(): PermModule[] {
  const out: PermModule[] = [];
  for (const section of sidebarNav.sections) {
    if (section.platformAdminOnly) continue;
    for (const entry of section.entries) {
      if (entry.type === "link") {
        if (!entry.permission || entry.platformAdminOnly) continue;
        out.push({
          id: entry.id,
          label: entry.label,
          icon: entry.icon,
          rows: [
            {
              id: entry.id,
              resource: entry.permission.resource,
              label: entry.label,
            },
          ],
        });
        continue;
      }
      const rows: ResourceRow[] = [];
      for (const child of entry.children) {
        if (!child.permission || child.platformAdminOnly) continue;
        rows.push({
          id: child.id,
          resource: child.permission.resource,
          label: child.label,
        });
      }
      if (rows.length)
        out.push({ id: entry.id, label: entry.label, icon: entry.icon, rows });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

export default function RolesPage(): React.JSX.Element {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canCreate = permissionsLoading || hasPermission("role", "create");
  const canEdit = permissionsLoading || hasPermission("role", "update");
  const canDelete = permissionsLoading || hasPermission("role", "delete");
  const rolesQ = useQuery({
    queryKey: ["roles"],
    queryFn: rbacService.listRoles,
    staleTime: 5 * 60 * 1000,
  });
  const catalogQ = useQuery({
    queryKey: ["catalog"],
    queryFn: rbacService.catalog,
    staleTime: 15 * 60 * 1000,
  });
  const usersQ = useQuery({
    queryKey: ["users"],
    queryFn: userService.listUsers,
    staleTime: 5 * 60 * 1000,
  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => rbacService.deleteRole(id),
    onSuccess: (_data, deletedId) => {
      qc.invalidateQueries({ queryKey: ["roles"] });
      setSelectedId((prev) => (prev === deletedId ? null : prev));
    },
  });

  const modules = useMemo(() => buildPermModules(), []);

  const actionsByResource = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const p of catalogQ.data?.permissions ?? [])
      (map[p.resource] ??= []).push(p.action);
    return map;
  }, [catalogQ.data]);

  const roles = rolesQ.data ?? [];
  const activeId = selectedId ?? roles[0]?.id ?? null;
  const activeRole = roles.find((r) => r.id === activeId) ?? null;
  const roleUsers = useMemo(() => {
    if (!activeId) return [];
    return (usersQ.data ?? []).filter((u) =>
      (u.roles ?? []).some((r) => r.id === activeId),
    );
  }, [usersQ.data, activeId]);

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-background">
      {/* Page header */}
      <div className="flex items-center gap-3 border-b border-stone-100 px-4 py-3 sm:px-6 sm:py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
          <ShieldCheck className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">
            Roles & Access
          </h1>
          <p className="text-sm text-stone-500">
            Control what each role can see and do.
          </p>
        </div>
      </div>

      {/* Split pane — stacks on mobile, side-by-side on md+ */}
      <div className="flex flex-col md:flex-row flex-1 min-h-0 overflow-hidden">
        {/* ── Left panel: role list — hidden on mobile when a role is selected ── */}
        <aside className={cn(
          "flex flex-col md:w-60 md:shrink-0 md:border-r border-stone-100",
          selectedId !== null ? "hidden md:flex" : "flex flex-1 md:flex-none",
        )}>
          {canCreate && (
            <div className="p-3 border-b border-stone-100">
              <button
                onClick={() => navigate("/config/roles/new")}
                className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand/50"
              >
                <Plus className="size-3.5" />
                New Role
              </button>
            </div>
          )}

          <div className="flex-1 overflow-y-auto modal-scrollbar p-2 space-y-0.5">
            {rolesQ.isLoading && (
              <p className="px-2 py-4 text-xs text-stone-400">Loading…</p>
            )}
            {rolesQ.isError && (
              <p className="px-2 py-2 text-xs text-red-500">
                {apiErrorMessage(rolesQ.error)}
              </p>
            )}

            {roles.map((role) => {
              const active = role.id === activeId;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedId(role.id)}
                  className={cn(
                    "w-full rounded-lg px-3 py-2.5 text-left transition-colors border",
                    active
                      ? "bg-brand/10 border-brand/25"
                      : "border-transparent hover:bg-stone-50",
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {role.isSystem && (
                      <Lock className="size-3 text-stone-400 shrink-0" />
                    )}
                    <span
                      className={cn(
                        "text-xs font-semibold truncate",
                        active ? "text-brand-dark" : "text-stone-700",
                      )}
                    >
                      {role.name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-2xs text-stone-400 truncate">
                    {role.permissions.length === 0
                      ? "No permissions"
                      : `${role.permissions.length} permission${role.permissions.length !== 1 ? "s" : ""}`}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Right panel: role detail — hidden on mobile until a role is selected ── */}
        <main className={cn(
          "flex-1 overflow-y-auto modal-scrollbar",
          selectedId === null && "hidden md:block",
        )}>
          {/* Mobile back button */}
          {selectedId !== null && (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="md:hidden flex items-center gap-1.5 w-full px-4 py-3 text-xs font-semibold text-brand-dark border-b border-stone-100 hover:bg-stone-50 transition-colors"
            >
              <ChevronLeft className="size-3.5" />
              Back to Roles
            </button>
          )}

          {!activeRole && !rolesQ.isLoading && (
            <div className="hidden md:flex h-full items-center justify-center">
              <div className="text-center">
                <ShieldCheck className="mx-auto mb-2 size-8 text-stone-300" />
                <p className="text-sm text-stone-400">
                  Select a role to view its permissions.
                </p>
              </div>
            </div>
          )}

          {activeRole && (
            <RoleDetail
              role={activeRole}
              modules={modules}
              actionsByResource={actionsByResource}
              roleUsers={roleUsers}
              usersLoading={usersQ.isLoading}
              onDelete={() => del.mutate(activeRole.id)}
              deleting={del.isPending}
              deleteError={del.error ? apiErrorMessage(del.error) : null}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          )}
        </main>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RoleDetail({
  role,
  modules,
  actionsByResource,
  roleUsers,
  usersLoading,
  onDelete,
  deleting,
  deleteError,
  canEdit,
  canDelete,
}: {
  role: Role;
  modules: PermModule[];
  actionsByResource: Record<string, string[]>;
  roleUsers: WorkspaceUser[];
  usersLoading: boolean;
  onDelete: () => void;
  deleting: boolean;
  deleteError: string | null;
  canEdit: boolean;
  canDelete: boolean;
}): React.JSX.Element {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"permissions" | "users">("permissions");
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showAssignUsers, setShowAssignUsers] = useState(false);

  // resource → action → scope (for quick grant lookup)
  const grantedMap = useMemo(() => {
    const map = new Map<string, Map<string, Scope>>();
    for (const p of role.permissions) {
      if (!map.has(p.resource)) map.set(p.resource, new Map());
      const resMap = map.get(p.resource);
      if (resMap) resMap.set(p.action, p.scope);
    }
    return map;
  }, [role]);

  const isWildcard = grantedMap.has("*");

  // columns = catalog actions that appear on ≥1 resource in this module, in canonical order
  function moduleColumns(rows: ResourceRow[]): string[] {
    const seen = new Set<string>();
    for (const row of rows)
      for (const a of actionsByResource[row.resource] ?? []) seen.add(a);
    return ACTION_ORDER.filter((a) => seen.has(a));
  }

  return (
    <div className="flex flex-col min-h-full">
      {/* ── Detail header ── */}
      <div className="flex items-start justify-between gap-3 px-3 pt-4 pb-3 sm:px-6 sm:pt-6 sm:pb-4">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-stone-900">{role.name}</h2>
            <Badge>{role.key}</Badge>
            {role.isSystem && (
              <Badge color="#8b5cf6">
                <Lock className="size-3" /> system
              </Badge>
            )}
          </div>
          {role.description && (
            <p className="text-xs text-stone-500 mt-0.5">{role.description}</p>
          )}
          <p className="mt-1 text-label text-stone-400">
            {role.permissions.length === 0
              ? "No permissions assigned."
              : `${role.permissions.length} permission${role.permissions.length !== 1 ? "s" : ""} granted`}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {canEdit && (
            <button
              type="button"
              onClick={() => setShowAssignUsers(true)}
              aria-label={`Add user to role ${role.name}`}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-50"
            >
              <UserPlus className="size-3.5" />
              Add user
            </button>
          )}
          {!role.isSystem && (
            <>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => navigate(`/config/roles/${role.id}/edit`)}
                  aria-label={`Edit role ${role.name}`}
                  className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-50"
                >
                  <Pencil className="size-3.5" />
                  Edit
                </button>
              )}
              {canDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  disabled={deleting}
                  aria-label={`Delete role ${role.name}`}
                  className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                  Delete
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {deleteError && (
        <div className="px-6 mb-2">
          <ErrorNote>{deleteError}</ErrorNote>
        </div>
      )}

      {/* ── Delete confirmation dialog ── */}
      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px]"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-role-title"
          onClick={(e) => { if (e.target === e.currentTarget) setShowDeleteConfirm(false); }}
        >
          <div className="w-full max-w-sm rounded-2xl border border-stone-200 bg-white p-6 shadow-xl">
            <div className="flex items-start gap-3 mb-4">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-red-50">
                <AlertTriangle className="size-4 text-red-500" />
              </span>
              <div>
                <h3 id="delete-role-title" className="text-sm font-bold text-stone-900">
                  Delete role?
                </h3>
                <p className="mt-1 text-xs text-stone-500 leading-relaxed">
                  <span className="font-semibold text-stone-700">{role.name}</span> will be
                  permanently removed. Users with this role will lose all associated permissions.
                  This cannot be undone.
                </p>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-semibold text-stone-600 transition hover:bg-stone-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => { onDelete(); setShowDeleteConfirm(false); }}
                disabled={deleting}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="size-3.5" />
                {deleting ? 'Deleting…' : 'Delete role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showAssignUsers && (
        <AssignUsersModal role={role} onClose={() => setShowAssignUsers(false)} />
      )}

      {/* ── Tab bar ── */}
      <div className="flex items-center gap-0 border-b border-stone-100 px-3 sm:px-6">
        {(
          [
            {
              id: "permissions",
              label: "Permissions",
              icon: ShieldCheck,
              count: role.permissions.length,
            },
            {
              id: "users",
              label: "Users",
              icon: Users,
              count: roleUsers.length,
            },
          ] as const
        ).map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold transition-colors",
                active
                  ? "text-stone-900"
                  : "text-stone-400 hover:text-stone-600",
              )}
            >
              <Icon className="size-3.5" />
              {tab.label}
              {tab.count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-2xs font-bold tabular-nums",
                    active
                      ? "bg-brand/15 text-brand-dark"
                      : "bg-stone-100 text-stone-400",
                  )}
                >
                  {tab.count}
                </span>
              )}
              {active && (
                <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-brand-dark" />
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 p-3 sm:p-6">
        {/* Permissions tab */}
        {activeTab === "permissions" && (
          <>
            {isWildcard && (
              <div className="rounded-xl border border-stone-200 p-6 text-center">
                <ShieldCheck className="mx-auto mb-2 size-6 text-brand-dark" />
                <p className="text-sm font-semibold text-stone-700">
                  Full Access
                </p>
                <p className="mt-1 text-xs text-stone-400">
                  Wildcard grant — all resources and actions are permitted.
                </p>
              </div>
            )}

            {!isWildcard && role.permissions.length === 0 && (
              <EmptyState>No permissions assigned to this role.</EmptyState>
            )}

            {!isWildcard && role.permissions.length > 0 && (
              <div className="space-y-4">
                {modules.map((mod) => {
                  const Icon = mod.icon;
                  const cols = moduleColumns(mod.rows);
                  const hasGrant = mod.rows.some((r) =>
                    grantedMap.has(r.resource),
                  );
                  if (!cols.length || !hasGrant) return null;

                  return (
                    <div
                      key={mod.id}
                      className="overflow-hidden rounded-xl border border-stone-200"
                    >
                      <div className="flex items-center gap-2 border-b border-stone-100 bg-stone-50 px-4 py-2.5">
                        <Icon className="size-3.5 text-stone-400" />
                        <span className="text-xs font-bold text-stone-600">
                          {mod.label}
                        </span>
                      </div>
                      <div className="overflow-x-auto modal-scrollbar">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-stone-100 bg-white">
                              <th className="py-2 pl-4 pr-3 text-left font-semibold text-stone-400 w-36">
                                Resource
                              </th>
                              {cols.map((c) => (
                                <th
                                  key={c}
                                  className="px-4 py-2 text-center font-semibold text-stone-400 whitespace-nowrap"
                                >
                                  {ACTION_LABELS[c] ?? c}
                                </th>
                              ))}
                              <th className="px-4 py-2 text-center font-semibold text-stone-400">
                                Scope
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-stone-50">
                            {mod.rows.map((row) => {
                              const rowGrants = grantedMap.get(row.resource);
                              const scopeVal = rowGrants
                                ? [...new Set(rowGrants.values())][0]
                                : null;
                              return (
                                <tr
                                  key={row.id}
                                  className="hover:bg-stone-50/60 transition-colors"
                                >
                                  <td className="py-3 pl-4 pr-3">
                                    <p className="font-medium text-stone-700">
                                      {row.label}
                                    </p>
                                    <p className="text-2xs text-stone-400">
                                      {row.resource}
                                    </p>
                                  </td>
                                  {cols.map((col) => {
                                    const granted =
                                      rowGrants?.has(col) ?? false;
                                    return (
                                      <td
                                        key={col}
                                        className="px-4 py-3 text-center"
                                      >
                                        {granted ? (
                                          <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand/15 mx-auto">
                                            <Check className="size-3 text-brand-dark" />
                                          </span>
                                        ) : (
                                          <span className="text-stone-200">
                                            —
                                          </span>
                                        )}
                                      </td>
                                    );
                                  })}
                                  <td className="px-4 py-3 text-center">
                                    {scopeVal ? (
                                      <span className="inline-block rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-2xs text-stone-500">
                                        {SCOPE_LABELS[scopeVal]}
                                      </span>
                                    ) : (
                                      <span className="text-stone-200">—</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* Users tab */}
        {activeTab === "users" && (
          <RoleUsersList users={roleUsers} loading={usersLoading} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function userInitials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join("");
}

function userAvatarColor(id: string): string {
  const palette = [
    "bg-violet-100 text-violet-700",
    "bg-sky-100 text-sky-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-rose-100 text-rose-700",
    "bg-indigo-100 text-indigo-700",
    "bg-teal-100 text-teal-700",
    "bg-orange-100 text-orange-700",
  ];
  const hash = [...id].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return palette[hash % palette.length];
}

function RoleUsersList({
  users,
  loading,
}: {
  users: WorkspaceUser[];
  loading: boolean;
}): React.JSX.Element {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-xs text-stone-400">Loading users…</p>
      </div>
    );
  }

  if (users.length === 0) {
    return <EmptyState>No users have been assigned this role yet.</EmptyState>;
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-stone-100 bg-stone-50">
            <th className="py-2 pl-3 pr-2 sm:py-2.5 sm:pl-4 sm:pr-3 text-left text-2xs sm:text-xs font-semibold text-stone-400">
              User
            </th>
            <th className="px-2 py-2 sm:px-4 sm:py-2.5 text-left text-2xs sm:text-xs font-semibold text-stone-400 hidden sm:table-cell">
              Email
            </th>
            <th className="px-2 py-2 sm:px-4 sm:py-2.5 text-left text-2xs sm:text-xs font-semibold text-stone-400">
              Status
            </th>
            <th className="px-2 py-2 sm:px-4 sm:py-2.5 text-left text-2xs sm:text-xs font-semibold text-stone-400 hidden md:table-cell">
              Joined
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-50">
          {users.map((user) => (
            <tr
              key={user.id}
              className="hover:bg-stone-50/60 transition-colors"
            >
              <td className="py-2 pl-3 pr-2 sm:py-3 sm:pl-4 sm:pr-3">
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "flex size-6 sm:size-7 shrink-0 items-center justify-center rounded-full text-2xs font-bold",
                      userAvatarColor(user.id),
                    )}
                  >
                    {userInitials(user.fullName || user.email)}
                  </span>
                  <span className="font-medium text-stone-800 truncate max-w-[90px] sm:max-w-[120px]">
                    {user.fullName || "—"}
                  </span>
                </div>
              </td>
              <td className="px-2 py-2 sm:px-4 sm:py-3 hidden sm:table-cell">
                <span className="text-stone-500 truncate">{user.email}</span>
              </td>
              <td className="px-2 py-2 sm:px-4 sm:py-3">
                {user.status === "active" ? (
                  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-2xs font-semibold text-emerald-700">
                    <span className="size-1.5 rounded-full bg-emerald-500" />
                    Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-2xs font-semibold text-amber-700">
                    <span className="size-1.5 rounded-full bg-amber-500" />
                    Suspended
                  </span>
                )}
              </td>
              <td className="px-2 py-2 sm:px-4 sm:py-3 hidden md:table-cell">
                <span className="text-stone-400">
                  {new Date(user.createdAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
