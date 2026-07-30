import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MapPin, Plus } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryBinService } from '@/services/inventoryBinService';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import type { Bin } from '@/types/inventory';
import { BinTreeNode } from './components/BinTreeNode';
import { BinFormDialog } from './components/BinFormDialog';
import { DeleteBinDialog } from './components/DeleteBinDialog';

function flattenAll(bins: Bin[], out: Bin[] = []): Bin[] {
  for (const b of bins) {
    out.push(b);
    if (b.children?.length) flattenAll(b.children, out);
  }
  return out;
}

export default function BinListPage() {
  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canEdit = permsLoading || hasPermission('inventory_bin', 'update');
  const canCreate = permsLoading || hasPermission('inventory_bin', 'create');

  const { lookups } = useInventoryLookups();
  const warehouses = lookups?.warehouses ?? [];
  const [warehouseFilter, setWarehouseFilter] = useState('');

  const { data: tree = [], isLoading, isError, error } = useQuery({
    queryKey: ['inventory-bins-tree', warehouseFilter],
    queryFn: () => inventoryBinService.getTree(warehouseFilter || undefined),
  });

  const allBins = flattenAll(tree);

  const [formTarget, setFormTarget] = useState<{ bin?: Bin; parentId?: string; warehouseId?: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bin | null>(null);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <MapPin className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Bin Management</h1>
              <p className="text-sm text-stone-500">Yards, racks, A-frames, aisles, shelves — flat locations, up to 4 levels deep.</p>
            </div>
          </div>
          {canCreate && (
            <button onClick={() => setFormTarget({ warehouseId: warehouseFilter })} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95">
              <Plus className="size-3.5" /> New Bin
            </button>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <select value={warehouseFilter} onChange={(e) => setWarehouseFilter(e.target.value)} aria-label="Filter by warehouse" className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-700">
            <option value="">All Warehouses</option>
            {warehouses.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto modal-scrollbar rounded-xl border border-stone-200 bg-white shadow-sm p-2">
          {isLoading ? (
            <Spinner label="Loading bins…" />
          ) : isError ? (
            <ErrorNote>{apiErrorMessage(error, 'Failed to load bins.')}</ErrorNote>
          ) : tree.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16">
              <div className="rounded-2xl bg-stone-100 p-4"><MapPin className="size-6 text-stone-400" /></div>
              <p className="text-sm font-semibold text-stone-700">No bins yet.</p>
              <p className="text-xs text-stone-400">Create your first bin to start organizing the yard.</p>
            </div>
          ) : (
            tree.map((b) => (
              <BinTreeNode
                key={b.id}
                bin={b}
                depth={0}
                canEdit={canEdit}
                onEdit={(bin) => setFormTarget({ bin })}
                onAddChild={(parent) => setFormTarget({ parentId: parent.id, warehouseId: parent.warehouseId })}
                onDelete={setDeleteTarget}
              />
            ))
          )}
        </div>
      </div>

      {formTarget && (
        <BinFormDialog
          bin={formTarget.bin}
          warehouses={warehouses}
          allBins={allBins}
          defaultWarehouseId={formTarget.warehouseId}
          defaultParentId={formTarget.parentId}
          onClose={() => setFormTarget(null)}
          onSaved={() => {}}
        />
      )}
      {deleteTarget && <DeleteBinDialog bin={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={() => {}} />}
    </div>
  );
}
