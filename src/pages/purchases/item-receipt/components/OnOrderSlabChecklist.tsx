import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { BinPicker } from '@/components/inventory/BinPicker';
import { MmDimensionInput } from '@/components/inventory/MmDimensionInput';
import { inventoryBinService } from '@/services/inventoryBinService';
import { BIN_STATUS_HINT, pageOf } from '@/lib/itemReceiptSlabs';
import { mmToDimension, normalizeUnit } from '@/lib/lineDimensions';
import {
  arrivalProgressText, arrivedSlabs, onOrderSlabArea, setAllArrived, setArrived, setBin, setBinForArrived, setThickness,
} from '@/lib/onOrderSlabs';
import { onOrderOf, type ItemReceiptDraftLine } from '@/lib/itemReceiptForm';
import { SlabPager } from './SlabPager';

const AREA_DISPLAY_DECIMALS = 3;

const thicknessCls =
  'w-24 rounded border border-stone-200 bg-white px-2 py-1 text-right text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 transition-all';

/** What the checklist changes on its line. */
export type OnOrderChecklistChange = Required<Pick<ItemReceiptDraftLine, 'onOrder'>>;

// The slabs the purchase order put on order for one line, each with a checkbox
// that says it arrived. Saving the receipt turns exactly the ticked slabs into
// available stock; the rest stay on order for a later receipt. A slab arrives at
// the size it was ordered at, so only a thickness the order left out is typed.
// The bin is optional and chosen per slab (a delivery can be spread over several
// bins, or not binned at all yet); one picker above sets it for every ticked slab.
export function OnOrderSlabChecklist({ line, onChange, warehouseId, problems }: {
  line: ItemReceiptDraftLine;
  onChange: (change: OnOrderChecklistChange) => void;
  /** The receiving warehouse's uuid — the bin is chosen from it. */
  warehouseId: string;
  /** What is still wrong with this line's ticked slabs. */
  problems: string[];
}) {
  const [page, setPage] = useState(1);
  const drafts = onOrderOf(line);
  const itemLabel = line.itemName || 'line';
  const lengthUnit = normalizeUnit(line.dimensionUnit);

  const { data: bins = [] } = useQuery({
    queryKey: ['inventory-bins-tree', warehouseId],
    queryFn: () => inventoryBinService.getTree(warehouseId),
    enabled: Boolean(warehouseId),
  });

  const arrived = arrivedSlabs(drafts).length;
  const allArrived = drafts.length > 0 && arrived === drafts.length;
  const view = pageOf(drafts, page);

  // The select-all box shows a dash while only some are ticked.
  const showPartial = (box: HTMLInputElement | null) => {
    if (box) box.indeterminate = arrived > 0 && !allArrived;
  };

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-stone-700">On-order slabs for {itemLabel}</p>
          <p className="mt-0.5 text-2xs text-stone-500" data-testid="arrival-progress">
            {arrivalProgressText(arrived, drafts.length)}
            {' — tick the slabs that arrived. Slabs you leave unticked stay on order.'}
          </p>
          <p className="mt-0.5 text-2xs text-stone-500">{BIN_STATUS_HINT}</p>
        </div>
        <div className="w-60">
          {/* An action, not a setting: it stays on its prompt and writes the bin onto each ticked slab. */}
          <BinPicker
            bins={bins} value="" disabled={arrived === 0}
            onChange={(next) => { if (next) onChange({ onOrder: setBinForArrived(drafts, next) }); }}
            label="Set bin for ticked slabs" emptyLabel="Set bin for ticked slabs…"
          />
        </div>
      </div>

      <div className="overflow-x-auto modal-scrollbar">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="text-2xs font-semibold uppercase tracking-wide text-stone-500">
              <th className="w-8 px-1.5 py-1.5">
                <input
                  ref={showPartial}
                  type="checkbox"
                  checked={allArrived}
                  onChange={(e) => onChange({ onOrder: setAllArrived(drafts, e.target.checked) })}
                  aria-label={`Mark all slabs of ${itemLabel} as arrived`}
                  className="size-3.5 accent-emerald-600"
                />
              </th>
              <th className="min-w-[150px] px-1.5 py-1.5">Serial</th>
              <th className="w-24 px-1.5 py-1.5 text-right">Length ({lengthUnit})</th>
              <th className="w-24 px-1.5 py-1.5 text-right">Width ({lengthUnit})</th>
              <th className="w-28 px-1.5 py-1.5 text-right">Thickness ({lengthUnit})</th>
              <th className="w-24 px-1.5 py-1.5 text-right">Area ({line.unitCode})</th>
              <th className="min-w-[180px] px-1.5 py-1.5">Bin</th>
            </tr>
          </thead>
          <tbody>
            {view.items.map((slab) => {
              const area = onOrderSlabArea(slab, line.unitCode);
              // A thickness the order stated is final; only a missing one is typed.
              const thicknessKnown = slab.orderedThicknessMm > 0;
              return (
                <tr key={slab.id} className={cn('border-b border-stone-100', slab.arrived && 'bg-emerald-50/50')}>
                  <td className="px-1.5 py-1.5 align-middle">
                    <input
                      type="checkbox"
                      checked={slab.arrived}
                      onChange={(e) => onChange({ onOrder: setArrived(drafts, slab.id, e.target.checked) })}
                      aria-label={`Slab ${slab.serial} arrived`}
                      className="size-3.5 accent-emerald-600"
                    />
                  </td>
                  <td className="px-1.5 py-1.5 align-middle font-mono text-2xs text-stone-600">{slab.serial}</td>
                  <td className="px-1.5 py-1.5 align-middle text-right tabular-nums text-stone-600">
                    {mmToDimension(slab.lengthMm, lengthUnit)}
                  </td>
                  <td className="px-1.5 py-1.5 align-middle text-right tabular-nums text-stone-600">
                    {mmToDimension(slab.widthMm, lengthUnit)}
                  </td>
                  <td className="px-1.5 py-1.5 align-middle text-right tabular-nums text-stone-600">
                    {thicknessKnown ? (
                      mmToDimension(slab.orderedThicknessMm, lengthUnit)
                    ) : (
                      <MmDimensionInput
                        valueMm={slab.thicknessMm}
                        onChangeMm={(mm) => onChange({ onOrder: setThickness(drafts, slab.id, mm) })}
                        unit={lengthUnit}
                        label={`Thickness (${lengthUnit}) of slab ${slab.serial}`}
                        className={thicknessCls}
                      />
                    )}
                  </td>
                  <td className="px-1.5 py-1.5 align-middle text-right tabular-nums text-stone-600">
                    {area > 0 ? area.toFixed(AREA_DISPLAY_DECIMALS) : '—'}
                  </td>
                  <td className="px-1.5 py-1.5 align-middle">
                    {/* A bin only matters once the slab arrives, so an unticked slab's stays locked. */}
                    <BinPicker
                      bins={bins} value={slab.binId} disabled={!slab.arrived}
                      onChange={(next) => onChange({ onOrder: setBin(drafts, slab.id, next) })}
                      label={`Bin for slab ${slab.serial}`} emptyLabel="— No bin yet —"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <SlabPager noun="slabs" page={view} onPage={setPage} />

      {problems.length > 0 && (
        <ul role="alert" className="mt-2 space-y-0.5 text-2xs text-destructive">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
    </div>
  );
}
