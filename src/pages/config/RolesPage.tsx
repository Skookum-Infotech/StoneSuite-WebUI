import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Lock, ShieldCheck, Check, Pencil } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { rbacService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Badge, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { sidebarNav } from '@/config/sidebarNav';
import { cn } from '@/lib/utils';
import type { Role } from '@/types/tenant';

// ---------------------------------------------------------------------------

const ACTION_ORDER = ['read', 'create', 'update', 'delete', 'transition', 'configure'];

const ACTION_LABELS: Record<string, string> = {
  read: 'Read', create: 'Create', update: 'Edit',
  delete: 'Delete', transition: 'Transition', configure: 'Configure',
};

interface ResourceRow { id: string; resource: string; label: string }
interface PermModule   { id: string; label: string; icon: LucideIcon; rows: ResourceRow[] }

function buildPermModules(): PermModule[] {
  const out: PermModule[] = [];
  for (const section of sidebarNav.sections) {
    if (section.platformAdminOnly) continue;
    for (const entry of section.entries) {
      if (entry.type === 'link') {
        if (!entry.permission || entry.platformAdminOnly) continue;
        out.push({ id: entry.id, label: entry.label, icon: entry.icon,
          rows: [{ id: entry.id, resource: entry.permission.resource, label: entry.label }] });
        continue;
      }
      const rows: ResourceRow[] = [];
      for (const child of entry.children) {
        if (!child.permission || child.platformAdminOnly) continue;
        rows.push({ id: child.id, resource: child.permission.resource, label: child.label });
      }
      if (rows.length) out.push({ id: entry.id, label: entry.label, icon: entry.icon, rows });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------

export default function RolesPage() {
  const navigate  = useNavigate();
  const qc        = useQueryClient();
  const rolesQ    = useQuery({ queryKey: ['roles'],   queryFn: rbacService.listRoles });
  const catalogQ  = useQuery({ queryKey: ['catalog'], queryFn: rbacService.catalog  });

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const del = useMutation({
    mutationFn: (id: string) => rbacService.deleteRole(id),
    onSuccess: (_data, deletedId) => {
      qc.invalidateQueries({ queryKey: ['roles'] });
      setSelectedId((prev) => (prev === deletedId ? null : prev));
    },
  });

  const modules = useMemo(() => buildPermModules(), []);

  const actionsByResource = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const p of catalogQ.data?.permissions ?? []) (map[p.resource] ??= []).push(p.action);
    return map;
  }, [catalogQ.data]);

  const roles      = rolesQ.data ?? [];
  const activeId   = selectedId ?? roles[0]?.id ?? null;
  const activeRole = roles.find((r) => r.id === activeId) ?? null;

  return (
    <div className="flex flex-1 flex-col min-h-0 bg-white">

      {/* Page header */}
      <div className="flex items-center gap-3 border-b border-stone-100 px-6 py-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand/20 text-brand-dark">
          <ShieldCheck className="size-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-stone-900">Roles & Access</h1>
          <p className="text-sm text-stone-500">Control what each role can see and do.</p>
        </div>
      </div>

      {/* Split pane */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* ── Left panel: role list ── */}
        <aside className="flex flex-col w-60 shrink-0 border-r border-stone-100">

          <div className="p-3 border-b border-stone-100">
            <button
              onClick={() => navigate('/config/roles/new')}
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand/50"
            >
              <Plus className="size-3.5" />
              New Role
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {rolesQ.isLoading && <p className="px-2 py-4 text-xs text-stone-400">Loading…</p>}
            {rolesQ.isError  && <p className="px-2 py-2 text-xs text-red-500">{apiErrorMessage(rolesQ.error)}</p>}

            {roles.map((role) => {
              const active = role.id === activeId;
              return (
                <button
                  key={role.id}
                  type="button"
                  onClick={() => setSelectedId(role.id)}
                  className={cn(
                    'w-full rounded-lg px-3 py-2.5 text-left transition-colors border',
                    active ? 'bg-brand/10 border-brand/25' : 'border-transparent hover:bg-stone-50',
                  )}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    {role.isSystem && <Lock className="size-3 text-stone-400 shrink-0" />}
                    <span className={cn(
                      'text-xs font-semibold truncate',
                      active ? 'text-brand-dark' : 'text-stone-700',
                    )}>
                      {role.name}
                    </span>
                  </div>
                  <p className="mt-0.5 text-2xs text-stone-400 truncate">
                    {role.permissions.length === 0
                      ? 'No permissions'
                      : `${role.permissions.length} permission${role.permissions.length !== 1 ? 's' : ''}`}
                  </p>
                </button>
              );
            })}
          </div>
        </aside>

        {/* ── Right panel: role detail ── */}
        <main className="flex-1 overflow-y-auto">
          {!activeRole && !rolesQ.isLoading && (
            <div className="flex h-full items-center justify-center">
              <div className="text-center">
                <ShieldCheck className="mx-auto mb-2 size-8 text-stone-300" />
                <p className="text-sm text-stone-400">Select a role to view its permissions.</p>
              </div>
            </div>
          )}

          {activeRole && (
            <RoleDetail
              role={activeRole}
              modules={modules}
              actionsByResource={actionsByResource}
              onDelete={() => del.mutate(activeRole.id)}
              deleting={del.isPending}
              deleteError={del.error ? apiErrorMessage(del.error) : null}
            />
          )}
        </main>

      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function RoleDetail({
  role, modules, actionsByResource, onDelete, deleting, deleteError,
}: {
  role: Role;
  modules: PermModule[];
  actionsByResource: Record<string, string[]>;
  onDelete: () => void;
  deleting: boolean;
  deleteError: string | null;
}) {
  const navigate = useNavigate();
  // resource → action → scope (for quick grant lookup)
  const grantedMap = useMemo(() => {
    const map = new Map<string, Map<string, string>>();
    for (const p of role.permissions) {
      if (!map.has(p.resource)) map.set(p.resource, new Map());
      map.get(p.resource)!.set(p.action, p.scope);
    }
    return map;
  }, [role]);

  const isWildcard = grantedMap.has('*');

  // columns = catalog actions that appear on ≥1 resource in this module, in canonical order
  function moduleColumns(rows: ResourceRow[]) {
    const seen = new Set<string>();
    for (const row of rows)
      for (const a of (actionsByResource[row.resource] ?? [])) seen.add(a);
    return ACTION_ORDER.filter((a) => seen.has(a));
  }

  return (
    <div className="p-6">

      {/* Detail header */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h2 className="text-base font-bold text-stone-900">{role.name}</h2>
            <Badge>{role.key}</Badge>
            {role.isSystem && <Badge color="#8b5cf6"><Lock className="size-3" /> system</Badge>}
          </div>
          {role.description && <p className="text-xs text-stone-500 mt-0.5">{role.description}</p>}
          <p className="mt-1 text-label text-stone-400">
            {role.permissions.length === 0
              ? 'No permissions assigned.'
              : `${role.permissions.length} permission${role.permissions.length !== 1 ? 's' : ''} granted`}
          </p>
        </div>

        {!role.isSystem && (
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => navigate(`/config/roles/${role.id}/edit`)}
              aria-label={`Edit role ${role.name}`}
              className="flex items-center gap-1.5 rounded-lg border border-stone-200 px-3 py-1.5 text-xs font-semibold text-stone-600 transition hover:bg-stone-50"
            >
              <Pencil className="size-3.5" />
              Edit
            </button>
            <button
              type="button"
              onClick={onDelete}
              disabled={deleting}
              aria-label={`Delete role ${role.name}`}
              className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              Delete
            </button>
          </div>
        )}
      </div>

      {deleteError && <div className="mb-4"><ErrorNote>{deleteError}</ErrorNote></div>}

      {/* Wildcard — super_admin style */}
      {isWildcard && (
        <div className="rounded-xl border border-stone-200 p-6 text-center">
          <ShieldCheck className="mx-auto mb-2 size-6 text-brand-dark" />
          <p className="text-sm font-semibold text-stone-700">Full Access</p>
          <p className="mt-1 text-xs text-stone-400">
            Wildcard grant — all resources and actions are permitted.
          </p>
        </div>
      )}

      {/* Empty */}
      {!isWildcard && role.permissions.length === 0 && (
        <EmptyState>No permissions assigned to this role.</EmptyState>
      )}

      {/* Permission sections */}
      {!isWildcard && role.permissions.length > 0 && (
        <div className="space-y-4">
          {modules.map((mod) => {
            const Icon    = mod.icon;
            const cols    = moduleColumns(mod.rows);
            const hasGrant = mod.rows.some((r) => grantedMap.has(r.resource));
            if (!cols.length || !hasGrant) return null;

            return (
              <div key={mod.id} className="overflow-hidden rounded-xl border border-stone-200">

                {/* Section header */}
                <div className="flex items-center gap-2 border-b border-stone-100 bg-stone-50 px-4 py-2.5">
                  <Icon className="size-3.5 text-stone-400" />
                  <span className="text-xs font-bold text-stone-600">{mod.label}</span>
                </div>

                {/* Mini permission table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-stone-100 bg-white">
                        <th className="py-2 pl-4 pr-3 text-left font-semibold text-stone-400 w-36">Resource</th>
                        {cols.map((c) => (
                          <th key={c} className="px-4 py-2 text-center font-semibold text-stone-400 whitespace-nowrap">
                            {ACTION_LABELS[c] ?? c}
                          </th>
                        ))}
                        <th className="px-4 py-2 text-center font-semibold text-stone-400">Scope</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-50">
                      {mod.rows.map((row) => {
                        const rowGrants  = grantedMap.get(row.resource);
                        const scopeVal   = rowGrants ? [...new Set(rowGrants.values())][0] : null;

                        return (
                          <tr key={row.id} className="hover:bg-stone-50/60 transition-colors">
                            <td className="py-3 pl-4 pr-3">
                              <p className="font-medium text-stone-700">{row.label}</p>
                              <p className="text-2xs text-stone-400">{row.resource}</p>
                            </td>
                            {cols.map((col) => {
                              const granted = rowGrants?.has(col) ?? false;
                              return (
                                <td key={col} className="px-4 py-3 text-center">
                                  {granted ? (
                                    <span className="inline-flex size-5 items-center justify-center rounded-full bg-brand/15 mx-auto">
                                      <Check className="size-3 text-brand-dark" />
                                    </span>
                                  ) : (
                                    <span className="text-stone-200">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td className="px-4 py-3 text-center">
                              {scopeVal ? (
                                <span className="inline-block rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-2xs text-stone-500">
                                  {scopeVal}
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

    </div>
  );
}
