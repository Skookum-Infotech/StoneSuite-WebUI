import { Fragment } from 'react';
import { AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { isSerializedLine, receivingQty, type ItemReceiptDraftLine, type ReceiptLineError } from '@/lib/itemReceiptForm';
import type { ItemReceiptDraftSlab } from '@/lib/itemReceiptSlabs';
import { unitLabel } from '@/lib/unitLabels';
import { SlabRowsEditor } from './SlabRowsEditor';

const COLUMN_COUNT = 9;
const QTY_DISPLAY_DECIMALS = 3;

const inlineCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300 transition-all';

// Every row here is a fixed line inherited from the source purchase order —
// unlike PurchaseOrderItemsTab, there is no add/remove: a receipt can only
// ever settle lines that were actually ordered (backend AD-1). Each row
// stays always-editable rather than toggling in/out of an edit mode, since
// the whole point of this table is "type quantities into a known set of
// rows," not composing a new document from scratch.
//
// A slab-tracked line is the exception to "type a quantity": its received
// quantity is worked out from the slabs added under it (SlabRowsEditor), so the
// Receiving cell is read-only there and there is no Rejected quantity.
export function ReceiptLinesTable({ lines, onChange, lineErrors, serials, warehouseId }: {
  lines: ItemReceiptDraftLine[];
  onChange: (lines: ItemReceiptDraftLine[]) => void;
  /** Per-line validation failures (lib/itemReceiptForm.ts
   *  validateReceiptLineErrors) — rendered inline under the offending row's
   *  Rejected field via aria-describedby, not only in the page-level banner. */
  lineErrors: ReceiptLineError[];
  /** Previewed slab serials per PO line (lib/itemReceiptSlabs previewSerials). */
  serials: Record<string, string[]>;
  /** The receiving warehouse's uuid; a slab's bin is chosen from it. */
  warehouseId: string;
}) {
  function patch(purchaseOrderItemId: string, fields: Partial<ItemReceiptDraftLine>) {
    onChange(lines.map((l) => (l.purchaseOrderItemId === purchaseOrderItemId ? { ...l, ...fields } : l)));
  }
  function setSlabs(purchaseOrderItemId: string, slabs: ItemReceiptDraftSlab[]) {
    patch(purchaseOrderItemId, { slabs });
  }

  const errorByLine = new Map(lineErrors.map((e) => [e.purchaseOrderItemId, e.message]));
  // A slab line can have several unfinished slabs, so it keeps every message
  // (the Map above keeps only the last, which is all a single Rejected field needs).
  const problemsByLine = new Map<string, string[]>();
  for (const e of lineErrors) {
    const message = e.message.charAt(0).toUpperCase() + e.message.slice(1);
    problemsByLine.set(e.purchaseOrderItemId, [...(problemsByLine.get(e.purchaseOrderItemId) ?? []), message]);
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      <div className="overflow-x-auto modal-scrollbar">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr className="divide-x divide-stone-200">
              {[
                { label: 'Item', w: 'min-w-[160px]' },
                { label: 'SKU', w: 'min-w-[90px]' },
                { label: 'Unit', w: 'w-16' },
                { label: 'Ordered', w: 'w-20', right: true },
                { label: 'Received to Date', w: 'w-24', right: true },
                { label: 'Outstanding', w: 'w-24', right: true },
                { label: 'Receiving *', w: 'w-24', right: true },
                { label: 'Rejected', w: 'w-20', right: true },
                { label: 'Notes', w: 'min-w-[140px]' },
              ].map((c) => (
                <th key={c.label} className={cn('px-2.5 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap', c.w, c.right && 'text-right')}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {lines.map((line) => {
              const serialized = isSerializedLine(line);
              const outstanding = Math.max(line.qtyOrdered - line.qtyAlreadyReceived, 0);
              const receiving = receivingQty(line);
              const overOutstanding = receiving > outstanding;
              const lineError = serialized ? undefined : errorByLine.get(line.purchaseOrderItemId);
              const errorId = lineError ? `line-error-${line.purchaseOrderItemId}` : undefined;
              const outstandingId = overOutstanding ? `line-over-${line.purchaseOrderItemId}` : undefined;
              return (
                <Fragment key={line.purchaseOrderItemId}>
                <tr className="hover:bg-stone-50/70 transition-colors divide-x divide-stone-100">
                  <td className="px-2.5 py-2.5 font-medium text-stone-800">{line.itemName || <span className="text-stone-300">—</span>}</td>
                  <td className="px-2.5 py-2.5 font-mono text-2xs text-stone-500">{line.sku || '—'}</td>
                  <td className="px-2.5 py-2.5 text-stone-500 whitespace-nowrap" title={line.unitCode || undefined}>
                    {unitLabel(line.unitCode) || <span className="text-stone-300">—</span>}
                  </td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">{line.qtyOrdered}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-500">{line.qtyAlreadyReceived}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-500">{outstanding}</td>
                  <td className="px-2 py-1.5 align-top">
                    {serialized ? (
                      <p
                        className={cn('w-20 py-1 text-right tabular-nums text-xs text-stone-700', overOutstanding && 'text-amber-700')}
                        aria-label={`Quantity receiving for ${line.itemName || 'line'}, from its slabs`}
                        aria-describedby={outstandingId}
                      >
                        {receiving.toFixed(QTY_DISPLAY_DECIMALS)}
                      </p>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.qtyReceived}
                        onChange={(e) => patch(line.purchaseOrderItemId, { qtyReceived: e.target.value })}
                        placeholder="0"
                        aria-label={`Quantity receiving for ${line.itemName || 'line'}`}
                        aria-describedby={outstandingId}
                        className={cn(inlineCls, 'w-20 text-right', overOutstanding && 'border-amber-400 bg-amber-50')}
                      />
                    )}
                    {overOutstanding && (
                      <p id={outstandingId} className="mt-1 flex items-center gap-1 text-2xs text-amber-600">
                        <AlertTriangle className="size-2.5 shrink-0" aria-hidden="true" />
                        Exceeds outstanding
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    {serialized ? (
                      <p className="w-16 py-1 text-right text-xs text-stone-300" title="A refused slab is simply left out.">—</p>
                    ) : (
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={line.qtyRejected}
                        onChange={(e) => patch(line.purchaseOrderItemId, { qtyRejected: e.target.value })}
                        placeholder="0"
                        aria-label={`Quantity rejected for ${line.itemName || 'line'}`}
                        aria-invalid={Boolean(lineError)}
                        aria-describedby={errorId}
                        className={cn(inlineCls, 'w-16 text-right', lineError && 'border-red-400 bg-red-50')}
                      />
                    )}
                    {lineError && (
                      <p id={errorId} role="alert" className="mt-1 text-2xs text-destructive">
                        {lineError}
                      </p>
                    )}
                  </td>
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="text"
                      value={line.lineNotes}
                      onChange={(e) => patch(line.purchaseOrderItemId, { lineNotes: e.target.value })}
                      placeholder="Optional note"
                      aria-label={`Notes for ${line.itemName || 'line'}`}
                      className={cn(inlineCls, 'min-w-[120px]')}
                    />
                  </td>
                </tr>
                {serialized && (
                  <tr>
                    <td colSpan={COLUMN_COUNT} className="bg-white px-2.5 pb-3 pt-1">
                      <SlabRowsEditor
                        line={line}
                        onChange={(slabs) => setSlabs(line.purchaseOrderItemId, slabs)}
                        serials={serials[line.purchaseOrderItemId] ?? []}
                        warehouseId={warehouseId}
                        problems={problemsByLine.get(line.purchaseOrderItemId) ?? []}
                      />
                    </td>
                  </tr>
                )}
                </Fragment>
              );
            })}
            {lines.length === 0 && (
              <tr><td colSpan={COLUMN_COUNT} className="py-8 text-center text-stone-400">This order has no open lines.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="border-t border-stone-100 bg-stone-50/50 px-4 py-2.5 text-2xs text-stone-400">
        Leave <span className="font-medium text-stone-500">Receiving</span> blank to skip a line. Receiving beyond a
        line&apos;s ordered quantity needs an over-receipt reason when posting. A slab item is received slab by slab:
        add each slab under its line and the quantity is worked out from their areas.
      </p>
    </div>
  );
}
