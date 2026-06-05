import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Lock, ShieldCheck, X, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { rbacService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge, Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { sidebarNav } from '@/config/sidebarNav';
import { cn } from '@/lib/utils';
import type { Grant, Scope, Role } from '@/types/tenant';

// ---------------------------------------------------------------------------
// Action display — canonical order and human labels shown per resource row.
// ---------------------------------------------------------------------------

const ACTION_ORDER = ['read', 'create', 'update', 'delete', 'transition', 'configure'];

const ACTION_LABELS: Record<string, string> = {
  read:       'Read',
  create:     'Create',
  update:     'Edit',
  delete:     'Delete',
  transition: 'Transition',
  configure:  'Configure',
};

// ---------------------------------------------------------------------------

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
  const modules: PermModule[] = [];
  for (const section of sidebarNav.sections) {
    if (section.platformAdminOnly) continue;
    for (const entry of section.entries) {
      if (entry.type === 'link') {
        if (!entry.permission || entry.platformAdminOnly) continue;
        modules.push({
          id: entry.id,
          label: entry.label,
          icon: entry.icon,
          rows: [{ id: entry.id, resource: entry.permission.resource, label: entry.label }],
        });
        continue;
      }
      const rows: ResourceRow[] = [];
      for (const child of entry.children) {
        if (!child.permission || child.platformAdminOnly) continue;
        rows.push({ id: child.id, resource: child.permission.resource, label: child.label });
      }
      if (rows.length === 0) continue;
      modules.push({ id: entry.id, label: entry.label, icon: entry.icon, rows });
    }
  }
  return modules;
}

// ---------------------------------------------------------------------------

export default function RolesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
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
          {!showCreate && (
            <button
              onClick={() => setShowCreate(true)}
              className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand/50 cursor-pointer"
            >
              <Plus className="size-3.5" />
              New Role
            </button>
          )}
        </div>

        {/* Content */}
        <div className="mt-5 flex flex-1 flex-col min-h-0 border-t border-stone-100 pt-4 space-y-3">

          {showCreate && (
            <CreateRoleForm
              onClose={() => setShowCreate(false)}
              onDone={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['roles'] }); }}
            />
          )}

          {rolesQ.isLoading && <Spinner label="Loading roles…" />}
          {rolesQ.isError && <ErrorNote>{apiErrorMessage(rolesQ.error)}</ErrorNote>}
          {!rolesQ.isLoading && !rolesQ.isError && rolesQ.data?.length === 0 && !showCreate && (
            <EmptyState>No roles yet — create your first one.</EmptyState>
          )}

          {rolesQ.data?.map((role: Role) => (
            <div
              key={role.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-stone-200 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-bold text-stone-800">{role.name}</span>
                  <Badge>{role.key}</Badge>
                  {role.isSystem && (
                    <Badge color="#8b5cf6">
                      <Lock className="size-3" /> system
                    </Badge>
                  )}
                </div>
                {role.description && (
                  <p className="mt-0.5 text-[11px] text-stone-500">{role.description}</p>
                )}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {role.permissions.length === 0 && (
                    <span className="text-[11px] text-stone-400">No permissions</span>
                  )}
                  {role.permissions.map((p, i) => (
                    <Badge key={i}>{p.resource}:{p.action} · {p.scope}</Badge>
                  ))}
                </div>
              </div>
              {!role.isSystem && (
                <button
                  type="button"
                  aria-label={`Delete role ${role.name}`}
                  onClick={() => del.mutate(role.id)}
                  disabled={del.isPending}
                  className="shrink-0 rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
          ))}

          {del.error && <ErrorNote>{apiErrorMessage(del.error)}</ErrorNote>}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

// Per-row selection: which actions are checked + what scope applies.
type RowSelection = { actions: string[]; scope: Scope };

function CreateRoleForm({ onDone, onClose }: { onDone: () => void; onClose: () => void }) {
  const catalogQ = useQuery({ queryKey: ['catalog'], queryFn: rbacService.catalog });
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  // selected is keyed by row.id — each submodule is fully independent.
  const [selected, setSelected] = useState<Record<string, RowSelection>>({});

  const modules = useMemo(() => buildPermModules(), []);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(modules.map((m) => [m.id, true])),
  );

  // resource → actions available in the catalog (e.g. lead → [read, create, update, delete, transition])
  const actionsByResource = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const p of catalogQ.data?.permissions ?? []) {
      (map[p.resource] ??= []).push(p.action);
    }
    return map;
  }, [catalogQ.data]);

  const scopes = catalogQ.data?.scopes ?? (['all', 'team', 'own'] as Scope[]);

  function toggleAction(rowId: string, action: string) {
    setSelected((prev) => {
      const current = prev[rowId]?.actions ?? [];
      const has = current.includes(action);
      const next = has ? current.filter((a) => a !== action) : [...current, action];
      if (next.length === 0) {
        const { [rowId]: _, ...rest } = prev;
        return rest;
      }
      return { ...prev, [rowId]: { actions: next, scope: prev[rowId]?.scope ?? 'all' } };
    });
  }

  function setScope(rowId: string, scope: Scope) {
    setSelected((prev) =>
      prev[rowId] ? { ...prev, [rowId]: { ...prev[rowId], scope } } : prev,
    );
  }

  const create = useMutation({
    mutationFn: () => {
      const permissions: Grant[] = [];
      for (const mod of modules) {
        for (const row of mod.rows) {
          const sel = selected[row.id];
          if (!sel || sel.actions.length === 0) continue;
          for (const action of sel.actions) {
            permissions.push({ resource: row.resource, action, scope: sel.scope });
          }
        }
      }
      return rbacService.createRole(key.trim(), name.trim(), description.trim(), permissions);
    },
    onSuccess: onDone,
  });

  return (
    <div className="rounded-xl border border-stone-200 bg-stone-50">
      {/* Form header */}
      <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand/20 text-brand-dark">
            <ShieldCheck className="size-3.5" />
          </div>
          <span className="text-sm font-bold text-stone-900">New Role</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cancel"
          className="rounded-lg p-1 text-stone-400 hover:bg-stone-200 hover:text-stone-700"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Identity */}
      <div className="grid gap-3 px-4 py-4 sm:grid-cols-3 border-b border-stone-200">
        <div className="space-y-1">
          <Label htmlFor="rname" className="text-xs">Display name</Label>
          <Input id="rname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sales Rep" className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rkey" className="text-xs">Key</Label>
          <Input id="rkey" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sales_rep" className="h-8 text-xs" />
        </div>
        <div className="space-y-1">
          <Label htmlFor="rdesc" className="text-xs">Description</Label>
          <Input id="rdesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" className="h-8 text-xs" />
        </div>
      </div>

      {/* Permissions */}
      <div className="px-4 py-3">
        <p className="mb-2.5 text-xs font-bold uppercase tracking-wide text-stone-500">Access</p>

        {catalogQ.isLoading && <Spinner label="Loading…" />}
        {catalogQ.isError && <ErrorNote>{apiErrorMessage(catalogQ.error)}</ErrorNote>}

        {!catalogQ.isLoading && (
          <div className="space-y-1.5">
            {modules.map((mod) => {
              const Icon = mod.icon;
              const open = openModules[mod.id] ?? true;
              const granted = mod.rows.filter((r) => (selected[r.id]?.actions.length ?? 0) > 0).length;
              return (
                <div key={mod.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setOpenModules((s) => ({ ...s, [mod.id]: !open }))}
                    aria-expanded={open}
                    className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-stone-50 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Icon className="size-3.5 text-stone-400" />
                      <span className="text-xs font-semibold text-stone-700">{mod.label}</span>
                      {granted > 0 && (
                        <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-dark">
                          {granted}
                        </span>
                      )}
                    </div>
                    <ChevronDown
                      className={cn('size-3.5 text-stone-400 transition-transform duration-200', open && 'rotate-180')}
                    />
                  </button>

                  {open && (
                    <div className="border-t border-stone-100 divide-y divide-stone-100">
                      {mod.rows.map((row) => (
                        <PermissionRow
                          key={row.id}
                          row={row}
                          available={ACTION_ORDER.filter((a) => (actionsByResource[row.resource] ?? []).includes(a))}
                          checkedActions={selected[row.id]?.actions ?? []}
                          scope={selected[row.id]?.scope ?? 'all'}
                          scopes={scopes}
                          onToggle={(action) => toggleAction(row.id, action)}
                          onScope={(sc) => setScope(row.id, sc)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 border-t border-stone-200 px-4 py-3">
        {create.error && (
          <div className="mr-auto">
            <ErrorNote>{apiErrorMessage(create.error)}</ErrorNote>
          </div>
        )}
        <button
          type="button"
          onClick={onClose}
          disabled={create.isPending}
          className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-semibold text-stone-700 transition hover:bg-stone-50 disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => create.mutate()}
          disabled={create.isPending || !key.trim() || !name.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand/50 disabled:opacity-50"
        >
          {create.isPending ? 'Creating…' : 'Create Role'}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function PermissionRow({
  row,
  available,
  checkedActions,
  scope,
  scopes,
  onToggle,
  onScope,
}: {
  row: ResourceRow;
  available: string[];       // actions this resource supports, in canonical order
  checkedActions: string[];  // actions currently selected
  scope: Scope;
  scopes: Scope[];
  onToggle: (action: string) => void;
  onScope: (scope: Scope) => void;
}) {
  const hasAny = checkedActions.length > 0;

  return (
    <div className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 shrink-0">
        <p className="text-xs font-medium text-stone-700">{row.label}</p>
        <p className="text-[10px] text-stone-400">{row.resource}</p>
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        {available.length === 0 && (
          <span className="text-[11px] text-stone-300 italic">No actions in catalog</span>
        )}
        {available.map((action) => {
          const checked = checkedActions.includes(action);
          return (
            <label
              key={action}
              className="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-stone-600"
            >
              <Checkbox
                checked={checked}
                onCheckedChange={() => onToggle(action)}
                aria-label={`${ACTION_LABELS[action] ?? action} for ${row.label}`}
              />
              {ACTION_LABELS[action] ?? action}
            </label>
          );
        })}

        <select
          aria-label={`Scope for ${row.label}`}
          value={scope}
          disabled={!hasAny}
          onChange={(e) => onScope(e.target.value as Scope)}
          className="h-6 rounded border border-stone-200 bg-white px-1.5 text-[11px] text-stone-600 disabled:opacity-40"
        >
          {scopes.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
