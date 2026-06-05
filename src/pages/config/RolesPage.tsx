import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Lock, ShieldCheck } from 'lucide-react';
import { rbacService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Badge, Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { cn } from '@/lib/utils';
import type { Grant, Role } from '@/types/tenant';

const ACTION_LABELS: Record<string, string> = {
  read:       'Read',
  create:     'Create',
  update:     'Edit',
  delete:     'Delete',
  transition: 'Transition',
  configure:  'Configure',
};

const ACTION_COLORS: Record<string, string> = {
  read:       'bg-stone-100 text-stone-600 border-stone-200',
  create:     'bg-green-50 text-green-700 border-green-200',
  update:     'bg-blue-50 text-blue-700 border-blue-200',
  delete:     'bg-red-50 text-red-700 border-red-200',
  transition: 'bg-purple-50 text-purple-700 border-purple-200',
  configure:  'bg-amber-50 text-amber-700 border-amber-200',
};

// Groups grants by resource, preserving the first scope encountered.
function groupByResource(permissions: Grant[]) {
  const map = new Map<string, { actions: string[]; scope: string }>();
  for (const p of permissions) {
    const existing = map.get(p.resource);
    if (existing) {
      if (!existing.actions.includes(p.action)) existing.actions.push(p.action);
    } else {
      map.set(p.resource, { actions: [p.action], scope: p.scope });
    }
  }
  return map;
}

function ResourceName({ resource }: { resource: string }) {
  if (resource === '*') return <span className="text-xs font-semibold text-stone-700">All Resources</span>;
  const label = resource.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return <span className="text-xs font-semibold text-stone-700 w-32 shrink-0">{label}</span>;
}

export default function RolesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const rolesQ = useQuery({ queryKey: ['roles'], queryFn: rbacService.listRoles });

  const del = useMutation({
    mutationFn: (id: string) => rbacService.deleteRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex flex-1 flex-col min-h-0 bg-white p-6">

        {/* Page header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
              <ShieldCheck className="size-4.5" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-stone-900">Roles & Access</h1>
              <p className="text-xs text-stone-500">Control what each role can see and do.</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/config/roles/new')}
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand/50 cursor-pointer"
          >
            <Plus className="size-3.5" />
            New Role
          </button>
        </div>

        {/* Role list */}
        <div className="mt-5 flex flex-1 flex-col min-h-0 border-t border-stone-100 pt-4 space-y-3">
          {rolesQ.isLoading && <Spinner label="Loading roles…" />}
          {rolesQ.isError && <ErrorNote>{apiErrorMessage(rolesQ.error)}</ErrorNote>}
          {!rolesQ.isLoading && !rolesQ.isError && rolesQ.data?.length === 0 && (
            <EmptyState>No roles yet — create your first one.</EmptyState>
          )}

          {rolesQ.data?.map((role: Role) => {
            const grouped = groupByResource(role.permissions);
            const isWildcard = grouped.has('*');

            return (
              <div
                key={role.id}
                className="rounded-xl border border-stone-200 bg-white overflow-hidden"
              >
                {/* Role header bar */}
                <div className="flex items-center justify-between gap-3 px-4 py-3 bg-stone-50/70 border-b border-stone-100">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-sm font-bold text-stone-800">{role.name}</span>
                    <Badge>{role.key}</Badge>
                    {role.isSystem && (
                      <Badge color="#8b5cf6">
                        <Lock className="size-3" /> system
                      </Badge>
                    )}
                  </div>
                  {!role.isSystem && (
                    <button
                      type="button"
                      aria-label={`Delete role ${role.name}`}
                      onClick={() => del.mutate(role.id)}
                      disabled={del.isPending}
                      className="shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50 transition-colors"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>

                {/* Role body */}
                <div className="px-4 py-3">
                  {role.description && (
                    <p className="mb-3 text-[11px] text-stone-500">{role.description}</p>
                  )}

                  {role.permissions.length === 0 && (
                    <p className="text-[11px] text-stone-400 italic">No permissions assigned.</p>
                  )}

                  {isWildcard ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-stone-600">Full Access</span>
                      <span className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-400">
                        {grouped.get('*')?.scope}
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {[...grouped.entries()].map(([resource, { actions, scope }]) => (
                        <div key={resource} className="flex flex-wrap items-center gap-2">
                          <ResourceName resource={resource} />
                          <div className="flex flex-wrap gap-1">
                            {actions.map((action) => (
                              <span
                                key={action}
                                className={cn(
                                  'inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-semibold',
                                  ACTION_COLORS[action] ?? 'bg-stone-100 text-stone-600 border-stone-200',
                                )}
                              >
                                {ACTION_LABELS[action] ?? action}
                              </span>
                            ))}
                          </div>
                          <span className="rounded border border-stone-200 bg-stone-50 px-1.5 py-0.5 text-[10px] text-stone-400">
                            {scope}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {del.error && <ErrorNote>{apiErrorMessage(del.error)}</ErrorNote>}
        </div>

      </div>
    </div>
  );
}
