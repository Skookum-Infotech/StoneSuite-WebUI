import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { inventoryBundleService } from '@/services/inventoryBundleService';
import { apiErrorMessage } from '@/api/tenantClient';
import { ItemPicker } from '@/components/inventory/ItemPicker';
import { UnitPicker } from '@/components/inventory/UnitPicker';
import type { Bundle, InventoryItem, InventoryUnit } from '@/types/inventory';
import { TRACKING_SERIALIZED } from '@/types/inventory';

// Adds one unit to an open bundle. The first member fixes the bundle's item
// (spec §6) — once inventoryItemId is set, the item search is locked to it so
// a later add cannot pick a mismatched unit at all, rather than relying on
// the server to reject it.
export function AddBundleMemberPanel({ bundle, onAdded }: { bundle: Bundle; onAdded: () => void }) {
  const queryClient = useQueryClient();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [unit, setUnit] = useState<InventoryUnit | null>(null);

  const { mutate: add, isPending, error } = useMutation({
    mutationFn: () => inventoryBundleService.addMembers(bundle.id, { memberIds: [unit!.id] }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory-bundle', bundle.id] });
      setUnit(null);
      setItem(null);
      onAdded();
    },
  });

  const effectiveItemId = bundle.inventoryItemId || item?.id || '';

  return (
    <div className="rounded-lg border border-dashed border-stone-300 p-3 space-y-2">
      <p className="text-2xs font-semibold text-stone-500">Add Member</p>
      {!bundle.inventoryItemId && (
        <ItemPicker value={item} onChange={setItem} filters={[{ field: 'tracking', op: 'eq', value: TRACKING_SERIALIZED }]} />
      )}
      <UnitPicker itemId={effectiveItemId} warehouseId={String(bundle.warehouseId)} value={unit} onChange={setUnit} />
      {error && <p className="text-2xs text-destructive">{apiErrorMessage(error, 'Failed to add member.')}</p>}
      <button
        type="button"
        disabled={!unit || isPending}
        onClick={() => add()}
        className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover disabled:opacity-50 transition-colors"
      >
        <Plus className="size-3.5" /> {isPending ? 'Adding…' : 'Add to Bundle'}
      </button>
    </div>
  );
}
