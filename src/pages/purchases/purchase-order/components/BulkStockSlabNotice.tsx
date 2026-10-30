import { TriangleAlert } from 'lucide-react';

// Shown under a line that is being drafted in slabs for an area item that is
// not slab-tracked. Receiving such a line adds its area to the item's bulk
// on-hand figure and creates no slabs, so inventory would show none to pick.
export function BulkStockSlabNotice({ itemName }: { itemName: string }) {
  return (
    <div role="status" className="flex items-start gap-2 px-3 py-2.5 text-xs text-amber-800">
      <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
      <p>
        <span className="font-semibold">{itemName || 'This item'}</span> isn&apos;t slab-tracked. Receiving this line
        will add its area to bulk stock and won&apos;t create individual slabs. If these are slabs, set the item&apos;s
        Tracking to Serialized before receiving.
      </p>
    </div>
  );
}
