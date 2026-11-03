import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, Save } from 'lucide-react';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/api/tenantClient';
import { replenishmentService } from '@/services/replenishmentService';
import {
  MAX_DRAFT_VENDORS, REORDER_QUERY_KEY, createLabel, fmtQty, monthName, newSplitRow, planSummary,
  plannedTotal, qtyStep, splitError, usagePhrase, vendorQuantities, type CreatedBatch, type VendorSplitRow,
} from '@/lib/replenishment';
import type { DraftedOrder, ReorderItem } from '@/types/replenishment';
import { OpenOrdersNote } from './OpenOrdersNote';
import { ReorderStat } from './ReorderStat';
import { VendorSplitLine } from './VendorSplitLine';

/** One item that will run short, with the controls to split what it needs
 *  across vendors and create a draft PO for each. */
export function ReorderItemCard({ item, onCreated }: {
  item: ReorderItem;
  onCreated: (batch: CreatedBatch) => void;
}) {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<VendorSplitRow[]>(() => [newSplitRow(String(item.needed))]);

  const create = useMutation({
    mutationFn: () => replenishmentService.draft({
      inventoryItemId: item.inventoryItemId,
      vendors: vendorQuantities(rows),
    }),
    onSuccess: (drafted: DraftedOrder[]) => {
      const nameOf = (vendorId: string) => rows.find((r) => r.vendor?.id === vendorId)?.vendor?.name ?? 'Vendor';
      toast.success(drafted.length > 1 ? `${drafted.length} draft purchase orders created.` : 'Draft purchase order created.');
      onCreated({
        key: `${item.inventoryItemId}-${Date.now()}`,
        itemName: item.name,
        orders: drafted.map((d) => ({ id: d.purchaseOrderId, vendorName: nameOf(d.vendorId) })),
      });
      queryClient.invalidateQueries({ queryKey: [REORDER_QUERY_KEY] });
    },
    onError: (err) => toast.error(apiErrorMessage(err, 'Failed to create the draft purchase orders.')),
  });

  const planned = plannedTotal(rows);
  const problem = splitError(item, rows);
  const updateRow = (next: VendorSplitRow) => setRows((prev) => prev.map((r) => (r.key === next.key ? next : r)));
  const removeRow = (key: string) => setRows((prev) => prev.filter((r) => r.key !== key));

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-stone-900">
          {item.name} <span className="font-normal text-stone-400">· {item.sku} · {item.unit}</span>
        </p>
        <p className="text-2xs text-stone-500">
          Used {usagePhrase(item)} in {item.usage.map((u) => monthName(u.month)).join(', ')}
        </p>
      </div>

      <div className="my-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <ReorderStat label="Monthly requirement" value={fmtQty(item.monthlyRequirement)} />
        <ReorderStat label="On hand" value={fmtQty(item.onHand)} />
        <ReorderStat label="On open POs" value={fmtQty(item.onOrder)} />
        <ReorderStat label="Needed" value={fmtQty(item.needed)} emphasis />
      </div>

      <OpenOrdersNote orders={item.openOrders ?? []} unit={item.unit} />

      <div className="mt-3 space-y-2">
        {rows.map((row) => (
          <VendorSplitLine
            key={row.key}
            row={row}
            step={qtyStep(item)}
            canRemove={rows.length > 1}
            onChange={updateRow}
            onRemove={() => removeRow(row.key)}
          />
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, newSplitRow('')])}
          disabled={rows.length >= MAX_DRAFT_VENDORS}
          className="flex h-9 items-center gap-1.5 rounded-lg px-2.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3.5" aria-hidden="true" /> Add vendor
        </button>
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-2xs text-stone-500" aria-live="polite">{planSummary(item.needed, planned)}</span>
          <button
            type="button"
            onClick={() => create.mutate()}
            disabled={problem !== null || create.isPending}
            title={problem ?? undefined}
            className="flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-xs font-semibold text-stone-900 transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-50"
          >
            {create.isPending
              ? <Loader2 className="size-3.5 motion-safe:animate-spin" aria-hidden="true" />
              : <Save className="size-3.5" aria-hidden="true" />}
            {createLabel(rows.length)}
          </button>
        </div>
      </div>
    </div>
  );
}
