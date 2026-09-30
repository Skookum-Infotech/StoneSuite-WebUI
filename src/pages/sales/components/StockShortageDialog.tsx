import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { PackageX } from 'lucide-react';
import { formatStockQty } from '@/lib/stockShortage';
import type { StockShortage } from '@/types/salesOrder';

// Shown when a Sales Order cannot be saved because it asks for more of an item
// than is free. Nothing was saved, so the only ways on are to lower the
// quantities, restock, or (if the user may) start a requisition for the gap.
export function StockShortageDialog({ shortages, onClose, onRestock }: {
  shortages: StockShortage[];
  onClose: () => void;
  /** Starts a requisition for the shortfall; omit to hide the button (the user
   *  cannot create requisitions). */
  onRestock?: () => void;
}) {
  // Escape closes it wherever focus happens to be — after a click on the backdrop
  // focus is on the page, not inside the dialog.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="stock-shortage-title"
      aria-describedby="stock-shortage-desc"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="mx-4 w-full max-w-xl rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-100">
            <PackageX className="size-4 text-amber-700" aria-hidden="true" />
          </div>
          <div>
            <h3 id="stock-shortage-title" className="text-sm font-bold text-stone-900">Not enough stock</h3>
            <p id="stock-shortage-desc" className="mt-0.5 text-xs text-stone-500">
              This order was not saved. {shortages.length === 1 ? 'An item on it is' : 'Items on it are'} short of what is
              free — stock other open orders are already holding is not available to it.
            </p>
          </div>
        </div>

        <div className="mb-5 overflow-x-auto rounded-lg border border-stone-200">
          <table className="w-full min-w-[420px] text-left text-xs" aria-label="Items short of stock">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-3 py-2 text-2xs font-semibold uppercase tracking-wider text-stone-500">Item</th>
                <th className="px-3 py-2 text-right text-2xs font-semibold uppercase tracking-wider text-stone-500">Needed</th>
                <th className="px-3 py-2 text-right text-2xs font-semibold uppercase tracking-wider text-stone-500">Available</th>
                <th className="px-3 py-2 text-right text-2xs font-semibold uppercase tracking-wider text-stone-500">Short by</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {shortages.map((s) => (
                <tr key={s.itemId}>
                  <td className="px-3 py-2">
                    <p className="font-semibold text-stone-900">{s.name}</p>
                    <p className="font-mono text-2xs text-stone-400">{s.sku}</p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-stone-700">{formatStockQty(s.requested, s.unitCode)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-stone-700">{formatStockQty(s.available, s.unitCode)}</td>
                  <td className="whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums text-red-600">{formatStockQty(s.short, s.unitCode)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="mb-4 text-xs text-stone-600">
          Lower the quantities to what is available, or restock and save again.
        </p>

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            autoFocus
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50"
          >
            Close
          </button>
          {onRestock && (
            <button
              type="button"
              onClick={onRestock}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover active:scale-95 transition-all"
            >
              Create requisition for the shortfall
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
