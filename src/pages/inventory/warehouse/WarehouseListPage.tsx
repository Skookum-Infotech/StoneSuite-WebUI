import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useMutation } from '@tanstack/react-query';
import { Warehouse as WarehouseIcon, Plus, Pencil, Star, Trash2 } from 'lucide-react';
import { inventoryLookupService } from '@/services/inventoryLookupService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import type { Warehouse } from '@/types/inventory';
import { WarehouseFormDialog } from './components/WarehouseFormDialog';

export default function WarehouseListPage() {
  const queryClient = useQueryClient();
  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canUpdate = permsLoading || hasPermission('warehouse', 'update');
  const canCreate = permsLoading || hasPermission('warehouse', 'create');
  const canDelete = permsLoading || hasPermission('warehouse', 'delete');

  const { lookups, isLoading, error } = useInventoryLookups();
  const warehouses = lookups?.warehouses ?? [];
  const [formTarget, setFormTarget] = useState<{ warehouse?: Warehouse } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const { mutate: setDefault } = useMutation({
    mutationFn: (uuid: string) => inventoryLookupService.setDefaultWarehouse(uuid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-lookups'] }),
  });

  const { mutate: remove } = useMutation({
    mutationFn: (uuid: string) => inventoryLookupService.deleteWarehouse(uuid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inventory-lookups'] }),
    onError: (err) => setDeleteError(apiErrorMessage(err, 'Failed to delete warehouse.')),
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <WarehouseIcon className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Warehouses</h1>
              <p className="text-sm text-stone-500">Physical sites holding stock.</p>
            </div>
          </div>
          {canCreate && (
            <button onClick={() => setFormTarget({})} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95">
              <Plus className="size-3.5" /> New Warehouse
            </button>
          )}
        </div>

        {deleteError && <p className="mt-3 text-xs text-destructive">{deleteError}</p>}

        <div className="mt-5 flex-1 overflow-y-auto modal-scrollbar">
          {isLoading ? (
            <Spinner label="Loading warehouses…" />
          ) : error ? (
            <ErrorNote>{apiErrorMessage(error, 'Failed to load warehouses.')}</ErrorNote>
          ) : (
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-stone-200 bg-table-header">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Name</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Code</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">City</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {warehouses.length === 0 ? (
                    <tr><td colSpan={5} className="py-12 text-center text-stone-400">No warehouses yet.</td></tr>
                  ) : warehouses.map((w) => (
                    <tr key={w.id} className="hover:bg-accent/10 transition-colors">
                      <td className="px-4 py-3.5 font-medium text-stone-800">
                        <span className="flex items-center gap-1.5">
                          {w.name}
                          {w.isDefault && <Star className="size-3 fill-amber-400 text-amber-400" aria-label="Default warehouse" />}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-stone-500">{w.code}</td>
                      <td className="px-4 py-3.5 text-stone-500">{w.addrCity || '—'}</td>
                      <td className="px-4 py-3.5">
                        <span className={w.isActive ? 'text-emerald-600 font-semibold' : 'text-stone-400'}>{w.isActive ? 'Active' : 'Inactive'}</span>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          {canUpdate && !w.isDefault && (
                            <button type="button" onClick={() => setDefault(w.id)} aria-label={`Set ${w.name} as default`} title="Set as default" className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-500 hover:bg-accent hover:border-accent hover:text-accent-foreground transition-colors">
                              <Star className="size-3.5" />
                            </button>
                          )}
                          {canUpdate && (
                            <button type="button" onClick={() => setFormTarget({ warehouse: w })} aria-label={`Edit ${w.name}`} className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-500 hover:bg-accent hover:border-accent hover:text-accent-foreground transition-colors">
                              <Pencil className="size-3.5" />
                            </button>
                          )}
                          {canDelete && !w.isSystem && (
                            <button type="button" onClick={() => remove(w.id)} aria-label={`Delete ${w.name}`} className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-500 hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive transition-colors">
                              <Trash2 className="size-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {formTarget && <WarehouseFormDialog warehouse={formTarget.warehouse} onClose={() => setFormTarget(null)} onSaved={() => {}} />}
    </div>
  );
}
