import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Trash2, Lock } from 'lucide-react';
import { rbacService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PageHeader, Spinner, Badge, ErrorNote, EmptyState } from '@/components/tenant/ui';
import type { Grant, Scope, Role } from '@/types/tenant';

export default function RolesPage() {
  const qc = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const rolesQ = useQuery({ queryKey: ['roles'], queryFn: rbacService.listRoles });

  const del = useMutation({
    mutationFn: (id: string) => rbacService.deleteRole(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['roles'] }),
  });

  return (
    <div>
      <PageHeader
        title="Roles & Access"
        subtitle="Roles bundle resource + action + scope permissions. super_admin is system-managed."
        action={
          <Button size="sm" className="gap-1" onClick={() => setShowCreate((v) => !v)}>
            <Plus className="size-3.5" /> New role
          </Button>
        }
      />

      {showCreate && <CreateRoleForm onDone={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['roles'] }); }} />}

      {rolesQ.isLoading && <Spinner />}
      {rolesQ.error && <ErrorNote>{apiErrorMessage(rolesQ.error)}</ErrorNote>}
      {rolesQ.data && rolesQ.data.length === 0 && <EmptyState>No roles yet.</EmptyState>}

      <div className="space-y-3">
        {rolesQ.data?.map((role: Role) => (
          <div key={role.id} className="rounded-xl border border-stone-200 bg-white p-4 dark:border-stone-800 dark:bg-stone-900">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">{role.name}</span>
                <Badge>{role.key}</Badge>
                {role.isSystem && <Badge color="#8b5cf6"><Lock className="size-3" /> system</Badge>}
              </div>
              {!role.isSystem && (
                <button
                  type="button"
                  aria-label={`Delete role ${role.name}`}
                  onClick={() => del.mutate(role.id)}
                  disabled={del.isPending}
                  className="rounded-lg p-1.5 text-stone-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-50"
                >
                  <Trash2 className="size-3.5" />
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {role.permissions.map((p, i) => (
                <Badge key={i}>
                  {p.resource}:{p.action} · {p.scope}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
      {del.error && <div className="mt-3"><ErrorNote>{apiErrorMessage(del.error)}</ErrorNote></div>}
    </div>
  );
}

function CreateRoleForm({ onDone }: { onDone: () => void }) {
  const catalogQ = useQuery({ queryKey: ['catalog'], queryFn: rbacService.catalog });
  const [key, setKey] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  // selected[`resource:action`] = scope
  const [selected, setSelected] = useState<Record<string, Scope>>({});

  const toggle = (id: string) =>
    setSelected((s) => {
      const next = { ...s };
      if (next[id]) delete next[id];
      else next[id] = 'all';
      return next;
    });
  const setScope = (id: string, scope: Scope) => setSelected((s) => ({ ...s, [id]: scope }));

  const create = useMutation({
    mutationFn: () => {
      const permissions: Grant[] = Object.entries(selected).map(([id, scope]) => {
        const [resource, action] = id.split(':');
        return { resource, action, scope };
      });
      return rbacService.createRole(key, name, description, permissions);
    },
    onSuccess: onDone,
  });

  return (
    <div className="mb-5 rounded-xl border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-950/40">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="rkey">Key</Label>
          <Input id="rkey" value={key} onChange={(e) => setKey(e.target.value)} placeholder="sales_rep" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rname">Name</Label>
          <Input id="rname" value={name} onChange={(e) => setName(e.target.value)} placeholder="Sales Rep" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rdesc">Description</Label>
          <Input id="rdesc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
        </div>
      </div>

      <p className="mb-2 mt-4 text-xs font-bold text-stone-500">Permissions</p>
      {catalogQ.isLoading && <Spinner label="Loading catalog…" />}
      <div className="grid gap-1.5 sm:grid-cols-2">
        {catalogQ.data?.permissions.map((p) => {
          const id = `${p.resource}:${p.action}`;
          const on = id in selected;
          return (
            <div key={id} className="flex items-center justify-between rounded-lg border border-stone-200 px-3 py-1.5 dark:border-stone-700">
              <label className="flex items-center gap-2 text-xs font-semibold">
                <input type="checkbox" checked={on} onChange={() => toggle(id)} className="size-3.5 rounded border-stone-300" aria-label={id} />
                {id}
              </label>
              {on && (
                <select
                  aria-label={`Scope for ${id}`}
                  value={selected[id]}
                  onChange={(e) => setScope(id, e.target.value as Scope)}
                  className="h-7 rounded-md border border-stone-200 bg-white px-2 text-[11px] dark:border-stone-700 dark:bg-stone-900"
                >
                  {(catalogQ.data?.scopes ?? ['all', 'team', 'own']).map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              )}
            </div>
          );
        })}
      </div>

      {create.error && <div className="mt-3"><ErrorNote>{apiErrorMessage(create.error)}</ErrorNote></div>}
      <div className="mt-4">
        <Button size="sm" onClick={() => create.mutate()} disabled={create.isPending || !key || !name}>
          {create.isPending ? 'Creating…' : 'Create role'}
        </Button>
      </div>
    </div>
  );
}
