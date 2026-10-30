import { useState } from 'react';
import { cn } from '@/lib/utils';
import { BinPicker } from '@/components/inventory/BinPicker';
import { countReached, type BinAssignScope, type ItemReceiptDraftSlab } from '@/lib/itemReceiptSlabs';
import type { Bin } from '@/types/inventory';

const inputCls =
  'rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-500 transition-all';

function positionOf(raw: string): number | undefined {
  const n = Number(raw);
  return raw.trim() !== '' && Number.isInteger(n) && n >= 1 ? n : undefined;
}

// A delivery goes into a bin in runs — the first forty into one rack, the next
// sixty into another — so picking a bin slab by slab is the wrong tool. This
// puts a whole line, or a run of positions down it, into one bin; "only slabs
// with no bin yet" lets a second pass fill what the first left.
export function BulkBinPanel({ slabs, bins, onApply, onClose }: {
  slabs: ItemReceiptDraftSlab[];
  bins: Bin[];
  onApply: (binId: string, scope: BinAssignScope) => void;
  onClose: () => void;
}) {
  const [binId, setBinId] = useState('');
  const [ranged, setRanged] = useState(false);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [onlyUnassigned, setOnlyUnassigned] = useState(false);
  const [done, setDone] = useState<number | null>(null);

  const scope: BinAssignScope = {
    ...(ranged ? { from: positionOf(from), to: positionOf(to) } : {}),
    onlyUnassigned,
  };
  const reached = countReached(slabs, scope);
  const rangeBroken = ranged && (from.trim() !== '' && positionOf(from) === undefined || to.trim() !== '' && positionOf(to) === undefined);
  const canApply = binId !== '' && reached > 0 && !rangeBroken;

  function apply() {
    if (!canApply) return;
    onApply(binId, scope);
    setDone(reached);
  }

  return (
    <div className="mb-3 rounded-lg border border-stone-200 bg-white p-3" role="group" aria-label="Assign a bin to slabs">
      <p className="text-xs font-semibold text-stone-700">Assign a bin</p>
      <p className="mt-1 text-2xs text-stone-500">
        Puts slabs into one bin in a single step. Slab numbers are the row numbers, counted from 1 down this line.
      </p>

      <div className="mt-2 flex flex-wrap items-end gap-x-5 gap-y-2">
        <fieldset className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <legend className="sr-only">Which slabs</legend>
          <label className="flex items-center gap-1.5 text-xs text-stone-700">
            <input type="radio" name="bin-scope" checked={!ranged} onChange={() => { setRanged(false); setDone(null); }} aria-label="All slabs" />
            All {slabs.length} slab{slabs.length === 1 ? '' : 's'}
          </label>
          <label className="flex items-center gap-1.5 text-xs text-stone-700">
            <input type="radio" name="bin-scope" checked={ranged} onChange={() => { setRanged(true); setDone(null); }} aria-label="A range of slabs" />
            A range
          </label>
          {ranged && (
            <span className="flex items-center gap-1.5 text-2xs text-stone-500">
              slab
              <input
                type="number" min="1" step="1" inputMode="numeric" value={from}
                onChange={(e) => { setFrom(e.target.value); setDone(null); }}
                aria-label="From slab" className={cn(inputCls, 'w-16 text-right')}
              />
              to
              <input
                type="number" min="1" step="1" inputMode="numeric" value={to}
                onChange={(e) => { setTo(e.target.value); setDone(null); }}
                aria-label="To slab" className={cn(inputCls, 'w-16 text-right')}
              />
            </span>
          )}
        </fieldset>

        <label className="flex items-center gap-1.5 text-xs text-stone-700">
          <input
            type="checkbox" checked={onlyUnassigned}
            onChange={(e) => { setOnlyUnassigned(e.target.checked); setDone(null); }}
            aria-label="Only slabs with no bin yet"
          />
          Only slabs with no bin yet
        </label>
      </div>

      <div className="mt-2 flex flex-wrap items-end gap-3">
        <div className="w-64">
          <BinPicker
            bins={bins} value={binId} onChange={(v) => { setBinId(v); setDone(null); }}
            label="Bin to assign" emptyLabel="— Choose a bin —"
          />
        </div>
        <button
          type="button" onClick={apply} disabled={!canApply} aria-label="Assign bin to slabs"
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 transition-colors hover:bg-brand-hover disabled:opacity-40"
        >
          Assign bin
        </button>
        <button
          type="button" onClick={onClose}
          className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
        >
          Done
        </button>
      </div>

      <p className="mt-2 min-h-4 text-2xs text-stone-500" role="status">
        {done !== null
          ? <span className="text-emerald-700">Bin set on {done} slab{done === 1 ? '' : 's'}.</span>
          : `Sets the bin on ${reached} slab${reached === 1 ? '' : 's'}.`}
      </p>
    </div>
  );
}
