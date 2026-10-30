import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryStockService } from '@/services/inventoryStockService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { formatStockQty, isLowStock } from '@/lib/stockFormat';
import { unitLabel } from '@/lib/unitLabels';
import type { InventoryItem, ReorderPointInput } from '@/types/inventory';

const REORDER_STEP = 'any';
const NEGATIVE_REORDER_MESSAGE = "A reorder point can't be negative.";
const HEADERS = ['Location', 'On hand', 'Allocated', 'Available', 'Reorder point'] as const;

const inputCls =
  'w-24 rounded border border-stone-200 bg-white px-2 py-1 text-right text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 transition-all';

// Where a counted (non-slab) item's stock sits, location by location, with the
// reorder point for each. A location at or below its reorder point is flagged
// here and on the Stock on Hand list.
export function ItemStockTab({ item }: { item: InventoryItem }) {
  const queryClient = useQueryClient();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('inventory_item', 'update');

  // What the user has typed per location, until it is saved.
  const [drafts, setDrafts] = useState<Record<number, string>>({});
  const [fieldError, setFieldError] = useState<{ warehouseId: number; message: string } | null>(null);

  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ['inventory-stock', item.id],
    queryFn: () => inventoryStockService.forItem(item.id),
  });

  const save = useMutation({
    mutationFn: (input: ReorderPointInput) => inventoryStockService.setReorderPoint(input),
    onSuccess: (_row, input) => {
      setDrafts((d) => {
        const { [input.warehouseId]: _saved, ...rest } = d;
        return rest;
      });
      void queryClient.invalidateQueries({ queryKey: ['inventory-stock', item.id] });
      void queryClient.invalidateQueries({ queryKey: ['inventory-stock-totals'] });
    },
  });

  function submit(warehouseId: number, raw: string) {
    const value = Number(raw);
    if (raw.trim() === '' || !Number.isFinite(value) || value < 0) {
      setFieldError({ warehouseId, message: raw.trim() !== '' && value < 0 ? NEGATIVE_REORDER_MESSAGE : 'Enter a number, or 0 for none.' });
      return;
    }
    setFieldError(null);
    save.mutate({ itemId: item.id, warehouseId, reorderPoint: value });
  }

  if (isLoading) return <Spinner label="Loading stock…" />;
  if (error) return <ErrorNote>{apiErrorMessage(error, 'Failed to load stock.')}</ErrorNote>;

  if (rows.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-6 text-sm text-stone-600">
        <p className="font-semibold text-stone-800">No stock yet</p>
        <p className="mt-1 text-xs text-stone-500">
          This item hasn&apos;t been received into any location yet. Stock appears here once an item receipt for it is posted.
        </p>
      </div>
    );
  }

  const unit = unitLabel(rows[0].unitCode);

  return (
    <div className="space-y-3">
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                {HEADERS.map((h, i) => (
                  <th key={h} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 ${i > 0 ? 'text-right' : ''}`}>
                    {h}{i > 0 && i < HEADERS.length - 1 && unit ? ` (${unit})` : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((r) => {
                const draft = drafts[r.warehouseId];
                const shown = draft ?? String(r.reorderPoint);
                const error = fieldError?.warehouseId === r.warehouseId ? fieldError.message : null;
                const errorId = `reorder-error-${r.warehouseId}`;
                return (
                  <tr key={r.warehouseId} className="hover:bg-accent/10 transition-colors duration-150">
                    <td className="px-4 py-3.5 text-xs font-medium text-stone-800">
                      {r.warehouseName}
                      {isLowStock(r.onHand, r.reorderPoint) && (
                        <span className="ml-2 rounded-md bg-amber-50 px-2 py-0.5 text-2xs font-semibold text-amber-700">Low stock</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-stone-700">{formatStockQty(r.onHand)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums text-stone-500">{formatStockQty(r.allocated)}</td>
                    <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-stone-800">{formatStockQty(r.available)}</td>
                    <td className="px-4 py-3.5 text-right">
                      {canEdit ? (
                        <div className="flex items-center justify-end gap-2">
                          <input
                            type="number" min="0" step={REORDER_STEP} inputMode="decimal"
                            value={shown}
                            onChange={(e) => setDrafts((d) => ({ ...d, [r.warehouseId]: e.target.value }))}
                            aria-label={`Reorder point at ${r.warehouseName}`}
                            aria-invalid={Boolean(error)}
                            aria-describedby={error ? errorId : undefined}
                            className={inputCls}
                          />
                          <button
                            type="button"
                            onClick={() => submit(r.warehouseId, shown)}
                            disabled={draft === undefined || save.isPending}
                            aria-label={`Save reorder point at ${r.warehouseName}`}
                            className="inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 transition-colors"
                          >
                            {save.isPending && save.variables?.warehouseId === r.warehouseId && <Loader2 className="size-3 animate-spin" aria-hidden="true" />}
                            Save
                          </button>
                        </div>
                      ) : (
                        <span className="tabular-nums text-stone-700">{formatStockQty(r.reorderPoint)}</span>
                      )}
                      {error && <p id={errorId} role="alert" className="mt-1 text-2xs text-destructive">{error}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {save.isError && <ErrorNote>{apiErrorMessage(save.error, 'Failed to save the reorder point.')}</ErrorNote>}

      <p className="text-xs text-stone-500">
        Allocated is what open sales orders still hold; available is what is free to promise. A reorder point of 0 means none is set.
      </p>
    </div>
  );
}
