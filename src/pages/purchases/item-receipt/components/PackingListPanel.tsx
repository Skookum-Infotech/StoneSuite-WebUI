import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ClipboardPaste } from 'lucide-react';
import { cn } from '@/lib/utils';
import { inventoryService } from '@/services/inventoryService';
import { newDraftSlab, slabArea, type ItemReceiptDraftSlab } from '@/lib/itemReceiptSlabs';
import { PACKING_LIST_UNITS, parsePackingList, type PackingListUnit } from '@/lib/slabPackingList';
import { unitLabel } from '@/lib/unitLabels';

const inputCls =
  'rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300 transition-all';

const AREA_DISPLAY_DECIMALS = 3;
const PREVIEW_ROWS = 5;

// A slab this small or this large is far outside real stone (roughly a 0.3 m²
// offcut to a 10 m² jumbo slab); an average out there usually means the wrong
// unit was picked, so the preview warns before anything is added.
const MM2_PER_SQM = 1_000_000;
const MIN_PLAUSIBLE_SLAB_SQM = 0.3;
const MAX_PLAUSIBLE_SLAB_SQM = 10;

// Reads slab rows pasted from a supplier's packing list and adds them to the
// line — the same rows the receiver would otherwise type one at a time. The
// receiver sees exactly what was read (and what was skipped) before adding.
export function PackingListPanel({ itemId, unitCode, onAdd, onClose }: {
  itemId: string | null | undefined;
  unitCode: string;
  onAdd: (slabs: ItemReceiptDraftSlab[]) => void;
  onClose: () => void;
}) {
  const [text, setText] = useState('');
  const [unit, setUnit] = useState<PackingListUnit>('mm');
  // null = follow the item's own thickness until the receiver types one.
  const [typedThickness, setTypedThickness] = useState<string | null>(null);

  const { data: item } = useQuery({
    queryKey: ['inventory-item', itemId],
    queryFn: () => inventoryService.getItem(itemId ?? ''),
    enabled: Boolean(itemId),
  });
  const itemThickness = item?.thicknessMm ? String(item.thicknessMm) : '';
  const thickness = typedThickness ?? itemThickness;
  const defaultThicknessMm = parseFloat(thickness) > 0 ? parseFloat(thickness) : 0;

  const parsed = useMemo(() => parsePackingList(text, unit), [text, unit]);
  const needsDefault = parsed.slabs.some((s) => s.thicknessMm === null);
  const missingThickness = needsDefault && defaultThicknessMm === 0;

  const drafts = useMemo(
    () => parsed.slabs.map((s) => newDraftSlab({
      lengthMm: String(s.lengthMm),
      widthMm: String(s.widthMm),
      thicknessMm: String(s.thicknessMm ?? defaultThicknessMm),
      lot: s.lot,
    })),
    [parsed.slabs, defaultThicknessMm],
  );
  const totalArea = drafts.reduce((sum, d) => sum + slabArea(d.lengthMm, d.widthMm, unitCode), 0);
  const unitName = unitLabel(unitCode).toLowerCase();

  const averageSqm = parsed.slabs.length === 0 ? 0
    : parsed.slabs.reduce((sum, s) => sum + (s.lengthMm * s.widthMm) / MM2_PER_SQM, 0) / parsed.slabs.length;
  const implausible = parsed.slabs.length > 0
    && (averageSqm < MIN_PLAUSIBLE_SLAB_SQM || averageSqm > MAX_PLAUSIBLE_SLAB_SQM);

  const canAdd = parsed.slabs.length > 0 && !missingThickness;

  function add() {
    if (!canAdd) return;
    onAdd(drafts);
    onClose();
  }

  return (
    <div className="mb-3 rounded-lg border border-stone-200 bg-white p-3" role="group" aria-label="Paste from packing list">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-700">
        <ClipboardPaste className="size-3.5 text-stone-400" aria-hidden="true" />
        Paste from packing list
      </p>
      <p className="mt-1 text-2xs text-stone-400">
        One slab per line: length, width, optionally thickness and a lot — copied straight from your supplier&apos;s
        packing list or spreadsheet. Paste only those columns.
      </p>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={5}
        placeholder={'3048\t1524\t30\tB-1234\n3050\t1520\t30\tB-1234'}
        aria-label="Packing list rows"
        className={cn(inputCls, 'mt-2 block w-full font-mono')}
      />

      <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-2">
        <label className="block text-2xs font-medium text-stone-500">
          Sizes are in
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as PackingListUnit)}
            aria-label="Packing list units"
            className={cn(inputCls, 'mt-1 block')}
          >
            {PACKING_LIST_UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
          </select>
        </label>
        <label className="block text-2xs font-medium text-stone-500">
          Thickness (mm) for rows without one
          <input
            type="number" min="0" step="any" inputMode="decimal"
            value={thickness}
            onChange={(e) => setTypedThickness(e.target.value)}
            placeholder="e.g. 30"
            aria-label="Default thickness in millimetres"
            className={cn(inputCls, 'mt-1 block w-28 text-right')}
          />
        </label>
      </div>

      {parsed.slabs.length > 0 && (
        <div className="mt-3 rounded border border-stone-100 bg-stone-50/60 px-3 py-2" aria-live="polite">
          <p className="text-xs font-medium text-stone-700">
            {parsed.slabs.length} slab{parsed.slabs.length === 1 ? '' : 's'} read
            {unitName && totalArea > 0 ? ` · ${totalArea.toFixed(AREA_DISPLAY_DECIMALS)} ${unitName} in total` : ''}
          </p>
          <ul className="mt-1 space-y-0.5 text-2xs tabular-nums text-stone-500">
            {drafts.slice(0, PREVIEW_ROWS).map((d) => (
              <li key={d.key}>
                {d.lengthMm} × {d.widthMm} × {d.thicknessMm} mm{d.lot ? ` · ${d.lot}` : ''}
              </li>
            ))}
            {drafts.length > PREVIEW_ROWS && <li>… and {drafts.length - PREVIEW_ROWS} more</li>}
          </ul>
        </div>
      )}

      {implausible && (
        <p role="alert" className="mt-2 flex items-start gap-1.5 text-2xs text-amber-700">
          <AlertTriangle className="mt-px size-3 shrink-0" aria-hidden="true" />
          These slabs look unusually {averageSqm < MIN_PLAUSIBLE_SLAB_SQM ? 'small' : 'large'} — check that the sizes are
          in the units you picked.
        </p>
      )}
      {missingThickness && (
        <p role="alert" className="mt-2 text-2xs text-destructive">
          Some rows have no thickness — enter a default thickness above.
        </p>
      )}
      {parsed.problems.length > 0 && (
        <div role="alert" className="mt-2 text-2xs text-destructive">
          <p className="font-medium">These rows will be skipped:</p>
          <ul className="mt-0.5 space-y-0.5">
            {parsed.problems.map((p) => <li key={p}>{p}</li>)}
          </ul>
        </div>
      )}

      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          onClick={add}
          disabled={!canAdd}
          className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-40 transition-colors"
        >
          {parsed.slabs.length > 0 ? `Add ${parsed.slabs.length} slab${parsed.slabs.length === 1 ? '' : 's'}` : 'Add slabs'}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
