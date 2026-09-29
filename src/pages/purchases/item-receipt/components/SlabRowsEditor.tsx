import { Fragment, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, ClipboardPaste, Copy, Plus, Tags, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BinPicker } from '@/components/inventory/BinPicker';
import { inventoryBinService } from '@/services/inventoryBinService';
import { newDraftSlab, slabArea, slabProgressText, type ItemReceiptDraftSlab } from '@/lib/itemReceiptSlabs';
import type { ItemReceiptDraftLine } from '@/lib/itemReceiptForm';
import { ApplyToAllPanel } from './ApplyToAllPanel';
import { PackingListPanel } from './PackingListPanel';

const inlineCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300 transition-all';

const AREA_DISPLAY_DECIMALS = 3;
const SERIAL_PENDING_HINT = 'assigned on save';
const COLUMN_COUNT = 8;

const DIMENSION_COLUMNS = [
  { key: 'lengthMm', label: 'Length (mm)' },
  { key: 'widthMm', label: 'Width (mm)' },
  { key: 'thicknessMm', label: 'Thickness (mm)' },
] as const;

const EXTRA_FIELDS = [
  { key: 'blockId', label: 'Block ID' },
  { key: 'lot', label: 'Lot' },
  { key: 'grade', label: 'Grade' },
  { key: 'supplierCode', label: 'Supplier code' },
] as const;

// One row per physical slab on a serialized purchase-order line. The serial is
// previewed (the server assigns the real one when the receipt posts) and the
// area is computed for display; neither is editable or ever sent. The line's
// received quantity is the sum of these areas.
export function SlabRowsEditor({ line, onChange, serials, warehouseId, problems }: {
  line: ItemReceiptDraftLine;
  onChange: (slabs: ItemReceiptDraftSlab[]) => void;
  /** Previewed serial per slab, in row order (blank while still loading). */
  serials: string[];
  /** The receiving warehouse's uuid — bins are chosen from it. */
  warehouseId: string;
  /** What is still wrong with this line's slabs (lib/itemReceiptForm.ts). */
  problems: string[];
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [panel, setPanel] = useState<'paste' | 'apply' | null>(null);

  const { data: bins = [] } = useQuery({
    queryKey: ['inventory-bins-tree', warehouseId],
    queryFn: () => inventoryBinService.getTree(warehouseId),
    enabled: Boolean(warehouseId),
  });

  function patch(key: string, fields: Partial<ItemReceiptDraftSlab>) {
    onChange(line.slabs.map((s) => (s.key === key ? { ...s, ...fields } : s)));
  }
  function remove(key: string) {
    onChange(line.slabs.filter((s) => s.key !== key));
  }
  function duplicate(slab: ItemReceiptDraftSlab) {
    // A supplier code identifies one physical slab, so a copy starts without it.
    const copy = newDraftSlab({ ...slab, supplierCode: '' });
    const at = line.slabs.findIndex((s) => s.key === slab.key);
    onChange([...line.slabs.slice(0, at + 1), copy, ...line.slabs.slice(at + 1)]);
  }
  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  const itemLabel = line.itemName || 'line';
  const count = line.slabs.length;

  // "11 of about 12 slabs" — what the buyer expected against what has arrived,
  // counting this receipt's slabs on top of earlier receipts'. Informational.
  const earlier = line.slabsReceived ?? 0;
  const expected = line.expectedSlabs ?? null;
  const overExpected = expected !== null && earlier + count > expected;
  const progress = expected !== null
    ? `${slabProgressText(earlier + count, expected)} with this receipt${earlier > 0 ? ` (${earlier} on earlier receipts)` : ''}${overExpected ? ' — more than expected' : ''}`
    : earlier > 0 ? `${earlier} slab${earlier === 1 ? '' : 's'} already received on earlier receipts` : '';

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-stone-700">
            Slabs for {itemLabel}
            <span className="ml-2 font-normal text-stone-400">
              {count === 0 ? 'None added — this line is skipped.' : `${count} slab${count === 1 ? '' : 's'}`}
            </span>
          </p>
          {progress && (
            <p className={cn('mt-0.5 text-2xs', overExpected ? 'text-amber-700' : 'text-stone-500')} data-testid="slab-progress">
              {progress}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPanel((p) => (p === 'paste' ? null : 'paste'))}
            aria-expanded={panel === 'paste'}
            aria-label={`Paste slabs from a packing list for ${itemLabel}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <ClipboardPaste className="size-3" aria-hidden="true" /> Paste from packing list
          </button>
          {count > 0 && (
            <button
              type="button"
              onClick={() => setPanel((p) => (p === 'apply' ? null : 'apply'))}
              aria-expanded={panel === 'apply'}
              aria-label={`Set lot and block for all slabs of ${itemLabel}`}
              className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
            >
              <Tags className="size-3" aria-hidden="true" /> Set lot / block for all
            </button>
          )}
          <button
            type="button"
            onClick={() => onChange([...line.slabs, newDraftSlab()])}
            aria-label={`Add a slab for ${itemLabel}`}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            <Plus className="size-3" aria-hidden="true" /> Add slab
          </button>
        </div>
      </div>

      {panel === 'paste' && (
        <PackingListPanel
          itemId={line.inventoryItemId}
          unitCode={line.unitCode}
          onAdd={(pasted) => onChange([...line.slabs, ...pasted])}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'apply' && (
        <ApplyToAllPanel
          slabCount={count}
          onApply={(fields) => onChange(line.slabs.map((s) => ({ ...s, ...fields })))}
          onClose={() => setPanel(null)}
        />
      )}

      {count > 0 && (
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-2xs font-semibold uppercase tracking-wide text-stone-500">
                <th className="w-8 px-1.5 py-1.5"><span className="sr-only">More fields</span></th>
                <th className="min-w-[150px] px-1.5 py-1.5">Serial</th>
                {DIMENSION_COLUMNS.map((c) => <th key={c.key} className="w-28 px-1.5 py-1.5">{c.label} *</th>)}
                <th className="w-24 px-1.5 py-1.5 text-right">Area ({line.unitCode})</th>
                <th className="min-w-[160px] px-1.5 py-1.5">Bin</th>
                <th className="w-20 px-1.5 py-1.5"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {line.slabs.map((slab, i) => {
                const n = i + 1;
                const open = expanded.has(slab.key);
                const area = slabArea(slab.lengthMm, slab.widthMm, line.unitCode);
                const moreId = `slab-more-${slab.key}`;
                return (
                  <Fragment key={slab.key}>
                    <tr className={cn(!open && 'border-b border-stone-100')}>
                      <td className="px-1.5 py-1.5 align-top">
                        <button
                          type="button"
                          onClick={() => toggle(slab.key)}
                          aria-expanded={open}
                          aria-controls={moreId}
                          aria-label={`${open ? 'Hide' : 'Show'} more fields for slab ${n}`}
                          className="rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
                        >
                          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        </button>
                      </td>
                      <td className="px-1.5 py-1.5 align-top font-mono text-2xs text-stone-500">
                        <span className="inline-block py-1" data-testid={`slab-serial-${n}`}>
                          {serials[i] || <span className="text-stone-300">{SERIAL_PENDING_HINT}</span>}
                        </span>
                      </td>
                      {DIMENSION_COLUMNS.map((c) => (
                        <td key={c.key} className="px-1.5 py-1.5 align-top">
                          <input
                            type="number" min="0" step="0.01" inputMode="decimal"
                            value={slab[c.key]}
                            onChange={(e) => patch(slab.key, { [c.key]: e.target.value })}
                            aria-label={`${c.label} of slab ${n}`}
                            className={cn(inlineCls, 'text-right')}
                          />
                        </td>
                      ))}
                      <td className="px-1.5 py-1.5 align-top text-right tabular-nums text-stone-600">
                        <span className="inline-block py-1">{area > 0 ? area.toFixed(AREA_DISPLAY_DECIMALS) : '—'}</span>
                      </td>
                      <td className="px-1.5 py-1.5 align-top">
                        <BinPicker
                          bins={bins} value={slab.binId} onChange={(binId) => patch(slab.key, { binId })}
                          label={`Bin for slab ${n}`} emptyLabel="— No bin —"
                        />
                      </td>
                      <td className="px-1.5 py-1.5 align-top">
                        <div className="flex justify-end gap-0.5">
                          <button type="button" onClick={() => duplicate(slab)} aria-label={`Duplicate slab ${n}`}
                            className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600">
                            <Copy className="size-3.5" />
                          </button>
                          <button type="button" onClick={() => remove(slab.key)} aria-label={`Remove slab ${n}`}
                            className="rounded p-1 text-stone-400 hover:bg-red-50 hover:text-red-600">
                            <Trash2 className="size-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {open && (
                      <tr id={moreId} className="border-b border-stone-100">
                        <td colSpan={COLUMN_COUNT}>
                          <div className="grid grid-cols-2 gap-3 pb-2 pl-9 pr-2 sm:grid-cols-4">
                            {EXTRA_FIELDS.map((f) => (
                              <label key={f.key} className="block text-2xs font-medium text-stone-500">
                                {f.label}
                                <input
                                  type="text"
                                  value={slab[f.key]}
                                  onChange={(e) => patch(slab.key, { [f.key]: e.target.value })}
                                  aria-label={`${f.label} of slab ${n}`}
                                  className={cn(inlineCls, 'mt-1')}
                                />
                              </label>
                            ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {problems.length > 0 && (
        <ul role="alert" className="mt-2 space-y-0.5 text-2xs text-destructive">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
    </div>
  );
}
