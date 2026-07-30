import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Layers } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { ItemPicker } from '@/components/inventory/ItemPicker';
import type { InventoryItem } from '@/types/inventory';

// GET /units/remnants — largest-usable-first, scoped to one catalog item
// (spec §3: "what can I use for this countertop"). Not a general remnants
// browser: the endpoint requires an item.
export function RemnantsFinder() {
  const navigate = useNavigate();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [minArea, setMinArea] = useState('');

  const { data: remnants = [], isLoading, isError, error } = useQuery({
    queryKey: ['inventory-remnants', item?.id, minArea],
    queryFn: () => inventoryUnitService.listRemnants(item!.id, minArea ? Number(minArea) : undefined),
    enabled: Boolean(item),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-72">
          <label className="mb-1.5 block text-xs font-semibold text-stone-900">Item</label>
          <ItemPicker value={item} onChange={setItem} />
        </div>
        <div className="w-32">
          <label className="mb-1.5 block text-xs font-semibold text-stone-900">Min area</label>
          <input type="number" min={0} value={minArea} onChange={(e) => setMinArea(e.target.value)} placeholder="Any" className="w-full h-10 px-3 text-xs border border-stone-300 rounded-[10px]" aria-label="Minimum area" />
        </div>
      </div>

      {!item && <p className="text-xs text-stone-400">Pick an item to see its usable remnants, largest first.</p>}
      {isError && <p className="text-xs text-red-500">{apiErrorMessage(error, 'Failed to load remnants.')}</p>}

      {item && (
        <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="overflow-x-auto modal-scrollbar">
            <table className="w-full min-w-[600px] text-left text-xs">
              <thead className="border-b border-stone-200 bg-table-header">
                <tr>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Serial</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Area</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Grade</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {isLoading ? (
                  <tr><td colSpan={4} className="px-4 py-6 text-center text-stone-400">Loading…</td></tr>
                ) : remnants.length > 0 ? (
                  remnants.map((r) => (
                    <tr key={r.id} className="hover:bg-accent/10 transition-colors">
                      <td className="px-4 py-3">
                        <button type="button" onClick={() => navigate(`/inventory/unit/${r.id}`)} className="font-mono text-xs font-semibold text-stone-900 hover:text-accent-foreground">{r.serial}</button>
                      </td>
                      <td className="px-4 py-3 tabular-nums text-right text-stone-700">{r.area.toFixed(2)}</td>
                      <td className="px-4 py-3 text-stone-500">{r.grade || '—'}</td>
                      <td className="px-4 py-3 text-stone-500">{r.binPath || r.warehouseName || '—'}</td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={4} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Layers className="size-6 text-stone-300" />
                      <p className="text-xs text-stone-400">No usable remnants for this item.</p>
                    </div>
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
