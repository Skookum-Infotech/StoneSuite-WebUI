import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Boxes, Plus } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryBundleService } from '@/services/inventoryBundleService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Spinner, ErrorNote, Badge } from '@/components/tenant/ui';
import { BUNDLE_OPEN, BUNDLE_SEALED } from '@/types/inventory';
import { NewBundleDialog } from './components/NewBundleDialog';

const STATUS_COLORS: Record<string, string> = { open: '#22c55e', sealed: '#3b82f6', broken: '#a8a29e' };

export default function BundleListPage() {
  const navigate = useNavigate();
  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canCreate = permsLoading || hasPermission('inventory_bundle', 'create');
  const [status, setStatus] = useState('');
  const [showNew, setShowNew] = useState(false);

  const { data: bundles = [], isLoading, isError, error } = useQuery({
    queryKey: ['inventory-bundles', status],
    queryFn: () => inventoryBundleService.listBundles(undefined, status || undefined),
  });

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14 flex-1 flex flex-col min-h-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10 shrink-0">
              <Boxes className="size-5 text-accent-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">Bundles</h1>
              <p className="text-sm text-stone-500">Pallets of slabs banded together — open, sealed, broken.</p>
            </div>
          </div>
          {canCreate && (
            <button onClick={() => setShowNew(true)} className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-brand text-stone-950 py-2 px-4 text-sm font-semibold shadow-sm transition hover:bg-brand-hover active:scale-95">
              <Plus className="size-3.5" /> New Bundle
            </button>
          )}
        </div>

        <div className="mt-5 flex items-center gap-2">
          <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Filter by status" className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-xs text-stone-700">
            <option value="">Any status</option>
            <option value={BUNDLE_OPEN}>Open</option>
            <option value={BUNDLE_SEALED}>Sealed</option>
            <option value="broken">Broken</option>
          </select>
        </div>

        <div className="mt-4 flex-1 overflow-y-auto modal-scrollbar">
          {isLoading ? (
            <Spinner label="Loading bundles…" />
          ) : isError ? (
            <ErrorNote>{apiErrorMessage(error, 'Failed to load bundles.')}</ErrorNote>
          ) : (
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-stone-200 bg-table-header">
                  <tr>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Code</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Item</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Members</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Total Area</th>
                    <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100">
                  {bundles.length === 0 ? (
                    <tr><td colSpan={6} className="py-12 text-center text-stone-400">No bundles yet.</td></tr>
                  ) : bundles.map((b) => (
                    <tr key={b.id} className="hover:bg-accent/10 transition-colors cursor-pointer" onClick={() => navigate(`/inventory/bundle/${b.id}`)}>
                      <td className="px-4 py-3.5 font-mono font-semibold text-stone-900">{b.code}</td>
                      <td className="px-4 py-3.5 text-stone-700 truncate max-w-[180px]">{b.inventoryItemName || <span className="text-stone-400">Unadopted</span>}</td>
                      <td className="px-4 py-3.5"><Badge color={STATUS_COLORS[b.status] ?? '#a8a29e'}>{b.status}</Badge></td>
                      <td className="px-4 py-3.5 tabular-nums text-right text-stone-700">{b.memberCount}</td>
                      <td className="px-4 py-3.5 tabular-nums text-right text-stone-700">{b.totalArea.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-stone-500 truncate max-w-[160px]">{b.binPath || b.warehouseName || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showNew && <NewBundleDialog onClose={() => setShowNew(false)} />}
    </div>
  );
}
