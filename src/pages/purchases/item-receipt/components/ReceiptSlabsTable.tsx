import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { ItemReceiptLine } from '@/types/itemReceipt';

const STATUS_STYLES: Record<string, string> = {
  available: 'bg-emerald-50 text-emerald-700',
  reserved: 'bg-amber-50 text-amber-700',
  in_transit: 'bg-sky-50 text-sky-700',
  consumed: 'bg-stone-100 text-stone-600',
  scrapped: 'bg-red-50 text-red-700',
};
const DEFAULT_STATUS_STYLE = 'bg-stone-100 text-stone-600';

function statusLabel(status: string): string {
  const spaced = status.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

// The slabs a receipt brought (or, while it is still pending, will bring) into
// Inventory, grouped by the line they arrived on. Once posted each serial links
// to its unit and shows that unit's LIVE status, so a slab that has since been
// reserved, cut or written off is visible from the document that received it.
export function ReceiptSlabsTable({ lines }: { lines: ItemReceiptLine[] }) {
  const navigate = useNavigate();
  const slabLines = lines.filter((l) => (l.slabs?.length ?? 0) > 0);
  if (slabLines.length === 0) return null;

  return (
    <div className="mt-4 space-y-3">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-500">Slabs received</h3>
      {slabLines.map((line) => (
        <div key={line.id} className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200 bg-white">
          <p className="border-b border-stone-100 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-700">
            Line {line.lineNumber} — {line.itemName || line.sku}
            <span className="ml-2 font-normal text-stone-400">{line.slabs?.length} slab{line.slabs?.length === 1 ? '' : 's'}</span>
          </p>
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-2xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="px-3 py-2">Serial</th>
                <th className="px-3 py-2">Size (mm)</th>
                <th className="px-3 py-2 text-right">Area ({line.unitCode})</th>
                <th className="px-3 py-2">Bin</th>
                <th className="px-3 py-2">Details</th>
                <th className="px-3 py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {line.slabs?.map((slab, i) => {
                const extras = [
                  slab.lot && `Lot ${slab.lot}`,
                  slab.blockId && `Block ${slab.blockId}`,
                  slab.grade && `Grade ${slab.grade}`,
                  slab.supplierCode && `Supplier ${slab.supplierCode}`,
                ].filter(Boolean).join(' · ');
                return (
                  <tr key={slab.serial || `pending-${i}`} className="hover:bg-stone-50/50">
                    <td className="px-3 py-2 font-mono text-2xs">
                      {slab.unitId && slab.serial ? (
                        <button
                          type="button"
                          onClick={() => navigate(`/inventory/unit/${slab.unitId}`)}
                          aria-label={`Open slab ${slab.serial}`}
                          className="font-semibold text-stone-900 hover:text-accent-foreground transition-colors"
                        >
                          {slab.serial}
                        </button>
                      ) : (
                        <span className="text-stone-400">Assigned when posted</span>
                      )}
                    </td>
                    <td className="px-3 py-2 tabular-nums text-stone-600">
                      {slab.lengthMm} × {slab.widthMm} × {slab.thicknessMm}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-stone-800">{slab.area}</td>
                    <td className="px-3 py-2 text-stone-600">{slab.binPath || <span className="text-stone-300">—</span>}</td>
                    <td className="px-3 py-2 text-stone-500">{extras || <span className="text-stone-300">—</span>}</td>
                    <td className="px-3 py-2">
                      {slab.unitStatus ? (
                        <span className={cn('rounded-full px-2 py-0.5 text-2xs font-medium', STATUS_STYLES[slab.unitStatus] ?? DEFAULT_STATUS_STYLE)}>
                          {statusLabel(slab.unitStatus)}
                        </span>
                      ) : (
                        <span className="text-stone-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
