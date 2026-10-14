import { useState } from 'react';
import { ArrowRight, Layers, Plus, Trash2 } from 'lucide-react';
import { BinPicker } from '@/components/inventory/BinPicker';
import { addUnits, applyDestinationToAll, type BinTransferDraftLine } from '@/lib/binTransferLines';
import type { Bin } from '@/types/inventory';
import { SlabPickerDialog } from './SlabPickerDialog';

// The slabs of a draft transfer and where each is going. Slabs come from the
// picker; every line has its own destination, with "Move all to" as the shortcut
// for the usual case of putting a delivery away in one place.
export function BinTransferLinesEditor({ lines, onChange, bins, warehouseId, locationChosen }: {
  lines: BinTransferDraftLine[];
  onChange: (lines: BinTransferDraftLine[]) => void;
  bins: Bin[];
  /** Numeric location id the slabs are picked from; 0 until a location is chosen. */
  warehouseId: number;
  locationChosen: boolean;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [allTo, setAllTo] = useState('');

  function setLine(key: string, patch: Partial<BinTransferDraftLine>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLine(key: string) {
    onChange(lines.filter((l) => l.key !== key));
  }
  const addedIds = new Set(lines.map((l) => l.unitId));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={!locationChosen}
          title={locationChosen ? undefined : 'Choose a location first'}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-xs font-semibold text-stone-950 shadow-sm transition-all hover:bg-brand-hover active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-3.5" /> Add slabs
        </button>

        {lines.length > 0 && (
          <div className="ml-auto flex flex-wrap items-end gap-2">
            <div className="w-56 space-y-1">
              <label className="block text-2xs font-semibold text-stone-500">Move all to</label>
              <BinPicker bins={bins} value={allTo} onChange={setAllTo} label="Move all slabs to bin" emptyLabel="Choose a bin…" />
            </div>
            <button
              type="button"
              disabled={!allTo}
              onClick={() => onChange(applyDestinationToAll(lines, allTo))}
              className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
            >
              Apply to all
            </button>
          </div>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-stone-300 bg-stone-50/60 py-10 text-center">
          <div className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-stone-200">
            <Layers className="size-5 text-stone-400" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-stone-700">No slabs on this transfer yet</p>
          <p className="max-w-xs text-xs text-stone-400">
            Add the slabs you are moving, then choose the bin each one is going to.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 modal-scrollbar">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wider text-stone-500">Slab</th>
                <th className="px-3 py-2.5 text-right text-2xs font-semibold uppercase tracking-wider text-stone-500">Area</th>
                <th className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wider text-stone-500">Now in</th>
                <th className="w-6 px-0 py-2.5" aria-hidden="true" />
                <th className="w-64 px-3 py-2.5 text-2xs font-semibold uppercase tracking-wider text-stone-500">Move to</th>
                <th className="w-10 px-2 py-2.5"><span className="sr-only">Remove</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {lines.map((l, i) => (
                <tr key={l.key} className="align-middle">
                  <td className="px-3 py-2.5">
                    <span className="block font-mono text-xs font-semibold text-stone-900">{l.serial}</span>
                    <span className="block truncate text-2xs text-stone-500">{l.itemName || '—'}</span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-stone-700">
                    {l.area.toFixed(2)} {l.areaUnitCode}
                  </td>
                  <td className="px-3 py-2.5 text-stone-500">{l.currentBinPath || <span className="text-stone-400">No bin</span>}</td>
                  <td className="px-0 py-2.5 text-stone-300"><ArrowRight className="size-3.5" aria-hidden="true" /></td>
                  <td className="px-3 py-2">
                    <BinPicker
                      bins={bins}
                      value={l.toBinId}
                      onChange={(toBinId) => setLine(l.key, { toBinId })}
                      label={`Destination bin for ${l.serial}`}
                      emptyLabel="Choose a bin…"
                    />
                  </td>
                  <td className="px-2 py-2.5 text-right">
                    <button
                      type="button"
                      onClick={() => removeLine(l.key)}
                      aria-label={`Remove line ${i + 1}, ${l.serial}`}
                      className="rounded p-1.5 text-stone-400 transition-colors hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {pickerOpen && (
        <SlabPickerDialog
          warehouseId={warehouseId}
          addedIds={addedIds}
          onAdd={(units) => {
            onChange(addUnits(lines, units, allTo));
            setPickerOpen(false);
          }}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}
