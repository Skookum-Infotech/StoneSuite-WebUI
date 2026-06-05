import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck, ChevronDown } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { rbacService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { sidebarNav } from '@/config/sidebarNav';
import { cn } from '@/lib/utils';
import type { Grant, Scope } from '@/types/tenant';

const ACTION_ORDER = ['read', 'create', 'update', 'delete', 'transition', 'configure'];

const ACTION_LABELS: Record<string, string> = {
  read:       'Read',
  create:     'Create',
  update:     'Edit',
  delete:     'Delete',
  transition: 'Transition',
  configure:  'Configure',
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

type RowSelection = { actions: string[]; scope: Scope };

export default function CreateRolePage() {
  const navigate = useNavigate();
  const catalogQ = useQuery({ queryKey: ['catalog'], queryFn: rbacService.catalog });
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Record<string, RowSelection>>({});

  const modules = useMemo(() => buildPermModules(), []);
  const [openModules, setOpenModules] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(modules.map((m) => [m.id, true])),
  );

  const actionsByResource = useMemo(() => {
    const map: Record<string, string[]> = {};
    for (const p of catalogQ.data?.permissions ?? []) {
      (map[p.resource] ??= []).push(p.action);
    }
    return map;
  }, [catalogQ.data]);

  const scopes = catalogQ.data?.scopes ?? (['all', 'team', 'own'] as Scope[]);

  function getAvailable(resource: string): string[] {
    return ACTION_ORDER.filter((a) => (actionsByResource[resource] ?? []).includes(a));
  }

  function toggleAction(rowId: string, action: string) {
    setSelected((prev) => {
      const current = prev[rowId]?.actions ?? [];
      const has = current.includes(action);
      const next = has ? current.filter((a) => a !== action) : [...current, action];
      if (next.length === 0) {
        const rest = { ...prev };
        delete rest[rowId];
        return rest;
      }
      return { ...prev, [rowId]: { actions: next, scope: prev[rowId]?.scope ?? 'all' } };
    });
  }

  function setRowScope(rowId: string, scope: Scope) {
    setSelected((prev) =>
      prev[rowId] ? { ...prev, [rowId]: { ...prev[rowId], scope } } : prev,
    );
  }

  // Returns true (all), 'indeterminate' (some), or false (none) for the module checkbox.
  function getModuleChecked(mod: PermModule): boolean | 'indeterminate' {
    const eligibleRows = mod.rows.filter((row) => getAvailable(row.resource).length > 0);
    if (eligibleRows.length === 0) return false;
    const allSelected = eligibleRows.every((row) =>
      getAvailable(row.resource).every((a) => selected[row.id]?.actions.includes(a)),
    );
    if (allSelected) return true;
    const anySelected = eligibleRows.some((row) => (selected[row.id]?.actions.length ?? 0) > 0);
    return anySelected ? 'indeterminate' : false;
  }

  function toggleModule(mod: PermModule) {
    const checked = getModuleChecked(mod);
    setSelected((prev) => {
      const next = { ...prev };
      if (checked === true) {
        // Deselect all rows in this module
        for (const row of mod.rows) delete next[row.id];
      } else {
        // Select all available actions for every row in this module
        for (const row of mod.rows) {
          const available = getAvailable(row.resource);
          if (available.length > 0) {
            next[row.id] = { actions: available, scope: prev[row.id]?.scope ?? 'all' };
          }
        }
      }
      return next;
    });
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
    onSuccess: () => navigate('/config/roles'),
  });

  return (
    <div className="flex flex-1 flex-col min-h-0">
      <div className="flex flex-1 flex-col min-h-0 bg-white">

        {/* Breadcrumb */}
        <div className="border-b border-stone-100 px-6 py-3">
          <button
            type="button"
            onClick={() => navigate('/config/roles')}
            className="inline-flex items-center gap-1.5 text-xs text-stone-500 hover:text-stone-800 transition-colors"
          >
            <ArrowLeft className="size-3.5" />
            Back to Roles
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="max-w-3xl">

            {/* Page header */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/20 text-brand-dark shrink-0">
                <ShieldCheck className="size-5" />
              </div>
              <div>
                <h1 className="text-base font-bold tracking-tight text-stone-900">Create New Role</h1>
                <p className="text-xs text-stone-500">Define permissions and access scope for this role.</p>
              </div>
            </div>

            {/* Role identity */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4 mb-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-stone-400">Role Details</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="rname" className="text-xs">
                    Display name <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="rname"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Sales Rep"
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rkey" className="text-xs">
                    Key <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    id="rkey"
                    value={key}
                    onChange={(e) => setKey(e.target.value)}
                    placeholder="sales_rep"
                    className="h-8 text-xs bg-white"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rdesc" className="text-xs">Description</Label>
                  <Input
                    id="rdesc"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional"
                    className="h-8 text-xs bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Access permissions */}
            <div className="rounded-xl border border-stone-200 bg-stone-50/60 p-4">
              <p className="mb-3 text-[11px] font-bold uppercase tracking-widest text-stone-400">Access Permissions</p>

              {catalogQ.isLoading && <Spinner label="Loading catalog…" />}
              {catalogQ.isError && <ErrorNote>{apiErrorMessage(catalogQ.error)}</ErrorNote>}

              {!catalogQ.isLoading && (
                <div className="space-y-2">
                  {modules.map((mod) => {
                    const Icon = mod.icon;
                    const open = openModules[mod.id] ?? true;
                    const moduleChecked = getModuleChecked(mod);
                    const grantedRows = mod.rows.filter((r) => (selected[r.id]?.actions.length ?? 0) > 0).length;

                    return (
                      <div key={mod.id} className="overflow-hidden rounded-lg border border-stone-200 bg-white">
                        {/* Module header */}
                        <div className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-stone-50 transition-colors">
                          <Checkbox
                            checked={moduleChecked}
                            onCheckedChange={() => toggleModule(mod)}
                            aria-label={`Select all permissions for ${mod.label}`}
                          />
                          <button
                            type="button"
                            onClick={() => setOpenModules((s) => ({ ...s, [mod.id]: !open }))}
                            aria-expanded={open}
                            className="flex flex-1 items-center justify-between text-left min-w-0"
                          >
                            <div className="flex items-center gap-2">
                              <Icon className="size-3.5 text-stone-400 shrink-0" />
                              <span className="text-xs font-semibold text-stone-700">{mod.label}</span>
                              {grantedRows > 0 && (
                                <span className="rounded-full bg-brand/15 px-1.5 py-0.5 text-[10px] font-bold text-brand-dark">
                                  {grantedRows}/{mod.rows.length}
                                </span>
                              )}
                            </div>
                            <ChevronDown
                              className={cn(
                                'size-3.5 text-stone-400 transition-transform duration-200 shrink-0',
                                open && 'rotate-180',
                              )}
                            />
                          </button>
                        </div>

                        {/* Resource rows */}
                        {open && (
                          <div className="border-t border-stone-100 divide-y divide-stone-100">
                            {mod.rows.map((row) => {
                              const available = getAvailable(row.resource);
                              const checkedActions = selected[row.id]?.actions ?? [];
                              const scope = selected[row.id]?.scope ?? 'all';
                              const hasAny = checkedActions.length > 0;

                              return (
                                <div
                                  key={row.id}
                                  className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                                >
                                  <div className="w-28 shrink-0">
                                    <p className="text-xs font-medium text-stone-700">{row.label}</p>
                                    <p className="text-[10px] text-stone-400">{row.resource}</p>
                                  </div>

                                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                                    {available.length === 0 ? (
                                      <span className="text-[11px] text-stone-300 italic">No actions in catalog</span>
                                    ) : (
                                      available.map((action) => (
                                        <label
                                          key={action}
                                          className="flex cursor-pointer items-center gap-1 text-[11px] font-medium text-stone-600"
                                        >
                                          <Checkbox
                                            checked={checkedActions.includes(action)}
                                            onCheckedChange={() => toggleAction(row.id, action)}
                                            aria-label={`${ACTION_LABELS[action] ?? action} for ${row.label}`}
                                          />
                                          {ACTION_LABELS[action] ?? action}
                                        </label>
                                      ))
                                    )}
                                    <select
                                      aria-label={`Scope for ${row.label}`}
                                      value={scope}
                                      disabled={!hasAny}
                                      onChange={(e) => setRowScope(row.id, e.target.value as Scope)}
                                      className="h-6 rounded border border-stone-200 bg-white px-1.5 text-[11px] text-stone-600 disabled:opacity-40 cursor-pointer"
                                    >
                                      {scopes.map((s) => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                    </select>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Sticky footer */}
        <div className="border-t border-stone-100 bg-white px-6 py-4 flex items-center justify-end gap-2">
          {create.error && (
            <div className="mr-auto">
              <ErrorNote>{apiErrorMessage(create.error)}</ErrorNote>
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate('/config/roles')}
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
    </div>
  );
}
