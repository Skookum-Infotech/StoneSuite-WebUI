import { Trash2, Pencil } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BinPicker } from '@/components/inventory/BinPicker';
import { MmDimensionInput } from '@/components/inventory/MmDimensionInput';
import { slabArea, type SlabGroup, type ItemReceiptDraftSlab, type SlabUnits } from '@/lib/itemReceiptSlabs';
import type { Bin } from '@/types/inventory';

const inlineCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-right text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-500 transition-all';

const AREA_DISPLAY_DECIMALS = 3;

const DIMENSION_COLUMNS = [
  { key: 'lengthMm', label: 'Length' },
  { key: 'widthMm', label: 'Width' },
  { key: 'thicknessMm', label: 'Thickness' },
] as const;

/** A group with its position down the list of groups, so "group 26" stays group
 *  26 whichever page it is on. */
export interface SlabGroupRow {
  group: SlabGroup;
  number: number;
}

export interface SlabGroupActions {
  /** Applies these fields to every slab in the group. */
  patch: (groupKey: string, fields: Partial<ItemReceiptDraftSlab>) => void;
  /** Turns the group into one row per slab, for edits that differ slab to slab. */
  expand: (groupKey: string) => void;
  remove: (groupKey: string) => void;
}

// A row's React key is its first slab's, not the group's: the group key is made
// from the very values being edited, so keying on it would remount the row (and
// drop focus) on every keystroke.
// Identical slabs collapsed into one row each, so a 300-slab delivery is a
// handful of rows and one bin picker per group instead of 300. Editing a row
// edits the whole group; "Edit slab by slab" opens the individual rows for the
// few slabs that differ. Sizes are shown and typed in the item's own unit.
export function SlabGroupTable({ rows, bins, units, actions }: {
  rows: SlabGroupRow[];
  bins: Bin[];
  units: SlabUnits;
  actions: SlabGroupActions;
}) {
  return (
    <div className="overflow-x-auto modal-scrollbar">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="text-2xs font-semibold uppercase tracking-wide text-stone-500">
            <th className="w-24 px-1.5 py-1.5">Slabs</th>
            {DIMENSION_COLUMNS.map((c) => <th key={c.key} className="w-28 px-1.5 py-1.5">{c.label} ({units.length}) *</th>)}
            <th className="w-28 px-1.5 py-1.5 text-right">Area ({units.area})</th>
            <th className="min-w-[160px] px-1.5 py-1.5">Bin</th>
            <th className="w-20 px-1.5 py-1.5"><span className="sr-only">Actions</span></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ group, number: n }) => {
            const each = slabArea(group.sample.lengthMm, group.sample.widthMm, units.area);
            const total = each * group.count;
            return (
              <tr key={group.sample.key} className="border-b border-stone-100">
                <td className="px-1.5 py-1.5 align-top">
                  <span className="inline-block py-1 font-medium text-stone-700">
                    {group.count} slab{group.count === 1 ? '' : 's'}
                  </span>
                </td>
                {DIMENSION_COLUMNS.map((c) => (
                  <td key={c.key} className="px-1.5 py-1.5 align-top">
                    <MmDimensionInput
                      valueMm={group.sample[c.key]}
                      onChangeMm={(mm) => actions.patch(group.key, { [c.key]: mm })}
                      unit={units.length}
                      label={`${c.label} (${units.length}) of group ${n}`}
                      className={cn(inlineCls)}
                    />
                  </td>
                ))}
                <td className="px-1.5 py-1.5 align-top text-right tabular-nums text-stone-600">
                  <span className="inline-block py-1">{total > 0 ? total.toFixed(AREA_DISPLAY_DECIMALS) : '—'}</span>
                </td>
                <td className="px-1.5 py-1.5 align-top">
                  <BinPicker
                    bins={bins} value={group.sample.binId} onChange={(binId) => actions.patch(group.key, { binId })}
                    label={`Bin for group ${n}`} emptyLabel="— No bin —"
                  />
                </td>
                <td className="px-1.5 py-1.5 align-top">
                  <div className="flex justify-end gap-0.5">
                    <button type="button" onClick={() => actions.expand(group.key)} aria-label={`Edit group ${n} slab by slab`}
                      title="Edit slab by slab"
                      className="rounded p-1 text-stone-500 hover:bg-stone-100 hover:text-stone-600">
                      <Pencil className="size-3.5" />
                    </button>
                    <button type="button" onClick={() => actions.remove(group.key)} aria-label={`Remove group ${n}`}
                      className="rounded p-1 text-stone-500 hover:bg-red-50 hover:text-red-600">
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
