import { useState } from 'react';
import { cn } from '@/lib/utils';

const inputCls =
  'rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300 transition-all';

export interface ApplyToAllFields {
  lot?: string;
  blockId?: string;
}

// A whole bundle usually shares one lot and one quarry block, so typing them on
// every slab is pure repetition. This stamps a lot and/or block ID onto every
// slab on the line in one go; a blank field is left alone, so applying just a
// lot never wipes block IDs already entered.
export function ApplyToAllPanel({ slabCount, onApply, onClose }: {
  slabCount: number;
  onApply: (fields: ApplyToAllFields) => void;
  onClose: () => void;
}) {
  const [lot, setLot] = useState('');
  const [blockId, setBlockId] = useState('');
  const [applied, setApplied] = useState(false);

  const fields: ApplyToAllFields = {
    ...(lot.trim() ? { lot: lot.trim() } : {}),
    ...(blockId.trim() ? { blockId: blockId.trim() } : {}),
  };
  const canApply = Object.keys(fields).length > 0 && slabCount > 0;

  function apply() {
    if (!canApply) return;
    onApply(fields);
    setApplied(true);
  }

  return (
    <div className="mb-3 rounded-lg border border-stone-200 bg-white p-3" role="group" aria-label="Set lot and block for all slabs">
      <p className="text-xs font-semibold text-stone-700">Set lot / block for all slabs</p>
      <p className="mt-1 text-2xs text-stone-400">
        Fills the lot and block ID on all {slabCount} slab{slabCount === 1 ? '' : 's'} on this line. Leave one blank to keep what is already there.
      </p>
      <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
        <label className="block text-2xs font-medium text-stone-500">
          Lot / bundle
          <input
            type="text" value={lot}
            onChange={(e) => { setLot(e.target.value); setApplied(false); }}
            aria-label="Lot for all slabs"
            className={cn(inputCls, 'mt-1 block w-40')}
          />
        </label>
        <label className="block text-2xs font-medium text-stone-500">
          Block ID
          <input
            type="text" value={blockId}
            onChange={(e) => { setBlockId(e.target.value); setApplied(false); }}
            aria-label="Block ID for all slabs"
            className={cn(inputCls, 'mt-1 block w-40')}
          />
        </label>
        <button
          type="button"
          onClick={apply}
          disabled={!canApply}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-40 transition-colors"
        >
          Apply to all slabs
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          Done
        </button>
      </div>
      <p className="mt-2 min-h-4 text-2xs text-emerald-700" role="status">
        {applied ? `Applied to ${slabCount} slab${slabCount === 1 ? '' : 's'}.` : ''}
      </p>
    </div>
  );
}
