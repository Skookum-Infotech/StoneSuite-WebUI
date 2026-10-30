import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { inventoryService } from '@/services/inventoryService';
import { pageOf } from '@/lib/itemReceiptSlabs';
import { mmToDimension, normalizeUnit } from '@/lib/lineDimensions';
import type { ItemReceiptLine } from '@/types/itemReceipt';
import { SlabPager } from './SlabPager';

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-emerald-50 text-emerald-700',
  reserved: 'bg-amber-50 text-amber-700',
  in_transit: 'bg-sky-50 text-sky-700',
  on_order: 'bg-violet-50 text-violet-700',
  received: 'bg-cyan-50 text-cyan-700',
  consumed: 'bg-stone-100 text-stone-600',
  scrapped: 'bg-red-50 text-red-700',
};
const DEFAULT_STATUS_STYLE = 'bg-stone-100 text-stone-600';

function statusLabel(status: string): string {
  const spaced = status.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// One received line's slabs, sized in the unit the item is measured in (the
// slabs themselves are stored in millimetres) and paged when the delivery is
// long. Once posted each serial links to its unit and shows that unit's LIVE
// status, so a slab that has since been reserved, cut or written off is visible
// from the document that received it.
export function ReceiptLineSlabs({ line }: { line: ItemReceiptLine }) {
  const [requestedPage, setRequestedPage] = useState(1);
  const { data: item } = useQuery({
    queryKey: ['inventory-item', line.inventoryItemId],
    queryFn: () => inventoryService.getItem(line.inventoryItemId ?? ''),
    enabled: Boolean(line.inventoryItemId),
  });
  const unit = normalizeUnit(item?.dimensionUnit);
  const slabs = line.slabs ?? [];
  const view = pageOf(slabs, requestedPage);

  return (
    <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
      <p className="border-b border-stone-100 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700">
        Line {line.lineNumber} — {line.itemName || line.sku}
        <span className="ml-2 font-normal text-stone-500">{slabs.length} slab{slabs.length === 1 ? '' : 's'}</span>
      </p>
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-2xs font-semibold uppercase tracking-wide text-stone-500">
            <th className="px-3 py-2">Serial</th>
            <th className="px-3 py-2 text-right">Length ({unit})</th>
            <th className="px-3 py-2 text-right">Width ({unit})</th>
            <th className="px-3 py-2 text-right">Thickness ({unit})</th>
            <th className="px-3 py-2 text-right">Area ({line.unitCode})</th>
            <th className="px-3 py-2">Bin</th>
            <th className="px-3 py-2">Details</th>
            <th className="px-3 py-2">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {view.items.map((slab, i) => {
            const extras = [
              slab.lot && `Lot ${slab.lot}`,
              slab.blockId && `Block ${slab.blockId}`,
              slab.grade && `Grade ${slab.grade}`,
              slab.supplierCode && `Supplier ${slab.supplierCode}`,
            ].filter(Boolean).join(' · ');
            return (
              <tr key={slab.serial || `pending-${view.offset + i}`} className="hover:bg-stone-50/50">
                <td className="px-3 py-2 font-mono text-2xs">
                  {slab.unitId && slab.serial ? (
                    <Link
                      to={`/inventory/unit/${slab.unitId}`}
                      aria-label={`Open slab ${slab.serial}`}
                      className="font-semibold text-stone-900 hover:text-accent-foreground transition-colors"
                    >
                      {slab.serial}
                    </Link>
                  ) : (
                    <span className="text-stone-500">Assigned when posted</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums text-stone-600">{mmToDimension(slab.lengthMm, unit)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-stone-600">{mmToDimension(slab.widthMm, unit)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-stone-600">{mmToDimension(slab.thicknessMm, unit)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-stone-800">{slab.area}</td>
                <td className="px-3 py-2 text-stone-600">{slab.binPath || <span className="text-stone-500">—</span>}</td>
                <td className="px-3 py-2 text-stone-500">{extras || <span className="text-stone-500">—</span>}</td>
                <td className="px-3 py-2">
                  {slab.unitStatus ? (
                    <span className={cn('rounded-full px-2 py-0.5 text-2xs font-medium', STATUS_STYLES[slab.unitStatus] ?? DEFAULT_STATUS_STYLE)}>
                      {statusLabel(slab.unitStatus)}
                    </span>
                  ) : (
                    <span className="text-stone-500">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="px-3 pb-2">
        <SlabPager noun="slabs" page={view} onPage={setRequestedPage} />
      </div>
    </div>
  );
}
