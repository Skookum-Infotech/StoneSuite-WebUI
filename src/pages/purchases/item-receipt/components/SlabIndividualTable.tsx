import { Fragment, useState } from 'react';
import { ChevronDown, ChevronRight, Copy, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BinPicker } from '@/components/inventory/BinPicker';
import { MmDimensionInput } from '@/components/inventory/MmDimensionInput';
import { slabArea, type ItemReceiptDraftSlab, type SlabUnits } from '@/lib/itemReceiptSlabs';
import type { Bin } from '@/types/inventory';

const inlineCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-500 transition-all';

const AREA_DISPLAY_DECIMALS = 3;
const SERIAL_PENDING_HINT = 'assigned on save';
const COLUMN_COUNT = 8;

const DIMENSION_COLUMNS = [
  { key: 'lengthMm', label: 'Length' },
  { key: 'widthMm', label: 'Width' },
  { key: 'thicknessMm', label: 'Thickness' },
] as const;

const EXTRA_FIELDS = [
  { key: 'blockId', label: 'Block ID' },
  { key: 'lot', label: 'Lot' },
  { key: 'grade', label: 'Grade' },
  { key: 'supplierCode', label: 'Supplier code' },
] as const;

/** A slab with its position down the whole line, so its label ("slab 7") and
 *  previewed serial stay put when only some of the line's slabs are listed. */
export interface SlabEntry {
  slab: ItemReceiptDraftSlab;
  index: number;
}

export interface SlabRowActions {
  patch: (slabKey: string, fields: Partial<ItemReceiptDraftSlab>) => void;
  remove: (slabKey: string) => void;
  duplicate: (slab: ItemReceiptDraftSlab) => void;
}

// One row per physical slab: its previewed serial, size, bin and the rarer
// per-slab fields behind a chevron. The serial is previewed (the server assigns
// the real one when the receipt posts) and the area is computed for display;
// neither is editable or ever sent.
export function SlabIndividualTable({ entries, serials, bins, units, actions }: {
  entries: SlabEntry[];
  /** Previewed serial per slab, by position down the line (blank while loading). */
  serials: string[];
  bins: Bin[];
  units: SlabUnits;
  actions: SlabRowActions;
}) {
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());

  function toggle(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  return (
    <div className="overflow-x-auto modal-scrollbar">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-2xs font-semibold uppercase tracking-wide text-stone-500">
            <th className="w-8 px-1.5 py-1.5"><span className="sr-only">More fields</span></th>
            <th className="min-w-[150px] px-1.5 py-1.5">Serial</th>
            {DIMENSION_COLUMNS.map((c) => <th key={c.key} className="w-28 px-1.5 py-1.5">{c.label} ({units.length}) *</th>)}
            <th className="w-24 px-1.5 py-1.5 text-right">Area ({units.area})</th>
            <th className="min-w-[160px] px-1.5 py-1.5">Bin</th>
            <th className="w-20 px-1.5 py-1.5"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {entries.map(({ slab, index }) => {
            const n = index + 1;
            const open = expanded.has(slab.key);
            const area = slabArea(slab.lengthMm, slab.widthMm, units.area);
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
                      className="rounded p-0.5 text-stone-500 hover:bg-stone-100 hover:text-stone-600"
                    >
                      {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    </button>
                  </td>
                  <td className="px-1.5 py-1.5 align-top font-mono text-2xs text-stone-500">
                    <span className="inline-block py-1" data-testid={`slab-serial-${n}`}>
                      {serials[index] || <span className="text-stone-500">{SERIAL_PENDING_HINT}</span>}
                    </span>
                  </td>
                  {DIMENSION_COLUMNS.map((c) => (
                    <td key={c.key} className="px-1.5 py-1.5 align-top">
                      <MmDimensionInput
                        valueMm={slab[c.key]}
                        onChangeMm={(mm) => actions.patch(slab.key, { [c.key]: mm })}
                        unit={units.length}
                        label={`${c.label} (${units.length}) of slab ${n}`}
                        className={cn(inlineCls, 'text-right')}
                      />
                    </td>
                  ))}
                  <td className="px-1.5 py-1.5 align-top text-right tabular-nums text-stone-600">
                    <span className="inline-block py-1">{area > 0 ? area.toFixed(AREA_DISPLAY_DECIMALS) : '—'}</span>
                  </td>
                  <td className="px-1.5 py-1.5 align-top">
                    <BinPicker
                      bins={bins} value={slab.binId} onChange={(binId) => actions.patch(slab.key, { binId })}
                      label={`Bin for slab ${n}`} emptyLabel="— No bin —"
                    />
                  </td>
                  <td className="px-1.5 py-1.5 align-top">
                    <div className="flex justify-end gap-0.5">
                      <button type="button" onClick={() => actions.duplicate(slab)} aria-label={`Duplicate slab ${n}`}
                        className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-600">
                        <Copy className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => actions.remove(slab.key)} aria-label={`Remove slab ${n}`}
                        className="rounded p-1 text-stone-500 hover:bg-red-50 hover:text-red-600">
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
                              onChange={(e) => actions.patch(slab.key, { [f.key]: e.target.value })}
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
  );
}
