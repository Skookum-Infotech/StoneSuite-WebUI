import { useState } from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { estimateQuantity, impliedAverage } from '@/lib/slabEstimate';
import { unitLabel } from '@/lib/unitLabels';

const inputCls =
  'rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300 transition-all text-right';

// Shown under a slab line while it is being added or edited. Stone is priced by
// area but ordered by bundle or lot, so the buyer usually knows "about 12
// slabs" rather than a square-foot total. Typing the slab count and an average
// size fills in the line's quantity; the quantity stays editable, and the
// expected count is saved on the line so receiving can show "11 of about 12".
export function SlabEstimateRow({ quantity, units, expectedSlabs, onChange }: {
  quantity: string;
  units: string;
  expectedSlabs: string;
  onChange: (key: 'expectedSlabs' | 'quantity', value: string) => void;
}) {
  const unit = unitLabel(units).toLowerCase() || 'area unit';
  // Starts from what a saved line implies, then belongs to the helper: the
  // average isn't stored, only the count and the resulting quantity are.
  const [avg, setAvg] = useState(() => impliedAverage(quantity, expectedSlabs));
  const estimate = estimateQuantity(expectedSlabs, avg);

  function changeSlabs(value: string) {
    onChange('expectedSlabs', value);
    const next = estimateQuantity(value, avg);
    if (next) onChange('quantity', next);
  }

  function changeAverage(value: string) {
    setAvg(value);
    const next = estimateQuantity(expectedSlabs, value);
    if (next) onChange('quantity', next);
  }

  return (
    <div className="flex flex-wrap items-end gap-x-4 gap-y-2 px-3 py-2.5">
      <span className="flex items-center gap-1.5 self-center text-xs font-semibold text-stone-600">
        <Layers className="size-3.5 text-stone-400" aria-hidden="true" />
        Slab estimate
      </span>
      <label className="block text-2xs font-medium text-stone-500">
        Expected slabs
        <input
          type="number" min="1" step="1" inputMode="numeric"
          value={expectedSlabs}
          onChange={(e) => changeSlabs(e.target.value)}
          placeholder="e.g. 12"
          aria-label="Expected slabs"
          className={cn(inputCls, 'mt-1 block w-24')}
        />
      </label>
      <label className="block text-2xs font-medium text-stone-500">
        Average {unit} per slab
        <input
          type="number" min="0" step="any" inputMode="decimal"
          value={avg}
          onChange={(e) => changeAverage(e.target.value)}
          placeholder="e.g. 50"
          aria-label={`Average ${unit} per slab`}
          className={cn(inputCls, 'mt-1 block w-28')}
        />
      </label>
      <p className="self-center text-xs tabular-nums text-stone-700" aria-live="polite">
        {estimate ? `= ${estimate} ${unit}` : ''}
      </p>
      <p className="basis-full text-2xs text-stone-400">
        Optional. Fills in the quantity — you can still type it directly. Slab sizes vary, so the exact area is
        measured when the slabs arrive; expected slabs is only a count to check the delivery against.
      </p>
    </div>
  );
}
