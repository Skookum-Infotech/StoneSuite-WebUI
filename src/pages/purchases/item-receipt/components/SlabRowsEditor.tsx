import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, ClipboardPaste, Plus, Tags } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BinPicker } from '@/components/inventory/BinPicker';
import { inventoryBinService } from '@/services/inventoryBinService';
import { inventoryService } from '@/services/inventoryService';
import {
  BIN_STATUS_HINT, GROUPED_ROW_THRESHOLD, MAX_GENERATED_SLABS, assignBin, generateSlabs, groupSlabs, newDraftSlab, pageOf, patchGroupMembers,
  slabProgressText, type BinAssignScope, type ItemReceiptDraftSlab, type SlabUnits,
} from '@/lib/itemReceiptSlabs';
import { normalizeUnit } from '@/lib/lineDimensions';
import type { ItemReceiptDraftLine } from '@/lib/itemReceiptForm';
import { ApplyToAllPanel } from './ApplyToAllPanel';
import { BulkBinPanel } from './BulkBinPanel';
import { SlabPager } from './SlabPager';
import { PackingListPanel } from './PackingListPanel';
import { SlabGroupTable, type SlabGroupActions, type SlabGroupRow } from './SlabGroupTable';
import { SlabIndividualTable, type SlabRowActions } from './SlabIndividualTable';

const headerButtonCls =
  'inline-flex shrink-0 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors disabled:cursor-not-allowed disabled:opacity-50';
const countInputCls =
  'w-20 rounded border border-stone-200 bg-white px-2 py-1 text-right text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 transition-all';

/** Why "Generate rows" can't run for this typed count, or null when it can. */
function generateBlocker(typed: string, existing: number): string | null {
  if (typed.trim() === '') return 'Enter how many slabs arrived.';
  const n = Number(typed);
  if (!Number.isInteger(n) || n < 1) return 'Enter a whole number of slabs.';
  if (n > MAX_GENERATED_SLABS) return `A receipt line takes up to ${MAX_GENERATED_SLABS} slabs.`;
  if (n <= existing) return `This line already has ${existing} slab row${existing === 1 ? '' : 's'}.`;
  return null;
}

// The slabs on a serialized purchase-order line. The receiver types how many
// arrived and the rows are made for them; identical slabs past a threshold
// collapse into one editable group row, and only the few that differ are opened
// slab by slab. The line's received quantity is the sum of the slabs' areas.
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
  const [panel, setPanel] = useState<'paste' | 'apply' | 'bin' | null>(null);
  // Slabs shown on their own row even while the rest are grouped.
  const [individual, setIndividual] = useState<ReadonlySet<string>>(new Set());
  // Which page of a long delivery each table is on, and the bin new slabs start in.
  const [groupPage, setGroupPage] = useState(1);
  const [slabPage, setSlabPage] = useState(1);
  const [newSlabBin, setNewSlabBin] = useState('');

  const { data: bins = [] } = useQuery({
    queryKey: ['inventory-bins-tree', warehouseId],
    queryFn: () => inventoryBinService.getTree(warehouseId),
    enabled: Boolean(warehouseId),
  });
  const { data: item, isLoading: itemLoading } = useQuery({
    queryKey: ['inventory-item', line.inventoryItemId],
    queryFn: () => inventoryService.getItem(line.inventoryItemId ?? ''),
    enabled: Boolean(line.inventoryItemId),
  });

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

  // What is still to arrive is the suggested count; a line with no stated
  // expectation starts blank.
  const [arrived, setArrived] = useState(() => (expected !== null ? String(Math.max(expected - earlier, 0)) : ''));
  const blocker = generateBlocker(arrived, count);

  function markIndividual(...keys: string[]) {
    setIndividual((prev) => new Set([...prev, ...keys]));
  }
  function generate() {
    const added = generateSlabs(Number(arrived) - count, {
      lengthMm: line.defaultLengthMm ? String(line.defaultLengthMm) : '',
      widthMm: line.defaultWidthMm ? String(line.defaultWidthMm) : '',
      thicknessMm: item?.thicknessMm ? String(item.thicknessMm) : '',
      binId: newSlabBin,
    });
    onChange([...line.slabs, ...added]);
  }

  const grouped = count > GROUPED_ROW_THRESHOLD;
  const entries = line.slabs.map((slab, index) => ({ slab, index }));
  const listed = grouped ? entries.filter((e) => individual.has(e.slab.key)) : entries;
  const groups = grouped ? groupSlabs(line.slabs.filter((s) => !individual.has(s.key))) : [];
  // Sizes are shown and typed in the unit the item is measured in (inches unless
  // the item says otherwise); the slabs themselves are kept in millimetres.
  const units: SlabUnits = { area: line.unitCode, length: normalizeUnit(item?.dimensionUnit ?? line.dimensionUnit) };
  const groupRows: SlabGroupRow[] = groups.map((group, i) => ({ group, number: i + 1 }));
  const groupView = pageOf(groupRows, groupPage);
  const slabView = pageOf(listed, slabPage);

  const rowActions: SlabRowActions = {
    patch: (key, fields) => onChange(line.slabs.map((s) => (s.key === key ? { ...s, ...fields } : s))),
    remove: (key) => onChange(line.slabs.filter((s) => s.key !== key)),
    duplicate: (slab) => {
      // A supplier code identifies one physical slab, so a copy starts without it.
      const copy = newDraftSlab({ ...slab, supplierCode: '' });
      const at = line.slabs.findIndex((s) => s.key === slab.key);
      markIndividual(copy.key);
      onChange([...line.slabs.slice(0, at + 1), copy, ...line.slabs.slice(at + 1)]);
    },
  };
  const groupActions: SlabGroupActions = {
    patch: (key, fields) => {
      const group = groups.find((g) => g.key === key);
      if (group) onChange(patchGroupMembers(line.slabs, group.memberKeys, fields));
    },
    expand: (key) => markIndividual(...(groups.find((g) => g.key === key)?.memberKeys ?? [])),
    remove: (key) => {
      const members = new Set(groups.find((g) => g.key === key)?.memberKeys);
      onChange(line.slabs.filter((s) => !members.has(s.key)));
    },
  };

  function assignBinToSlabs(binId: string, scope: BinAssignScope) {
    onChange(assignBin(line.slabs, binId, scope));
  }

  function addSlab() {
    const slab = newDraftSlab();
    markIndividual(slab.key);
    onChange([...line.slabs, slab]);
  }

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50/50 p-3">
      <div className="mb-2 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-stone-700">
            Slabs for {itemLabel}
            <span className="ml-2 font-normal text-stone-500">
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
            className={headerButtonCls}
          >
            <ClipboardPaste className="size-3" aria-hidden="true" /> Paste from packing list
          </button>
          {count > 0 && (
            <button
              type="button"
              onClick={() => setPanel((p) => (p === 'apply' ? null : 'apply'))}
              aria-expanded={panel === 'apply'}
              aria-label={`Set lot and block for all slabs of ${itemLabel}`}
              className={headerButtonCls}
            >
              <Tags className="size-3" aria-hidden="true" /> Set lot / block / thickness for all
            </button>
          )}
          {count > 0 && (
            <button
              type="button"
              onClick={() => setPanel((p) => (p === 'bin' ? null : 'bin'))}
              aria-expanded={panel === 'bin'}
              aria-label={`Assign a bin to slabs of ${itemLabel}`}
              className={headerButtonCls}
            >
              <Boxes className="size-3" aria-hidden="true" /> Assign bin
            </button>
          )}
          <button type="button" onClick={addSlab} aria-label={`Add a slab for ${itemLabel}`} className={headerButtonCls}>
            <Plus className="size-3" aria-hidden="true" /> Add slab
          </button>
        </div>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-stone-300 bg-white px-3 py-2">
        <label className="flex items-center gap-2 text-xs font-medium text-stone-700">
          Slabs arrived
          <input
            type="number" min="1" step="1" inputMode="numeric"
            value={arrived}
            onChange={(e) => setArrived(e.target.value)}
            aria-label="Slabs arrived on this receipt"
            aria-invalid={Boolean(blocker) && arrived.trim() !== ''}
            className={countInputCls}
          />
        </label>
        <div className="w-52">
          <BinPicker
            bins={bins} value={newSlabBin} onChange={setNewSlabBin}
            label="Bin for new slabs" emptyLabel="— No bin yet —"
          />
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={Boolean(blocker) || itemLoading}
          aria-label={`Generate rows for ${itemLabel}`}
          className={headerButtonCls}
        >
          Generate rows
        </button>
        {blocker && <p className="text-2xs text-stone-500">{blocker}</p>}
      </div>
      <p className="mb-2 text-2xs text-stone-500">{BIN_STATUS_HINT}</p>

      {panel === 'paste' && (
        <PackingListPanel
          itemId={line.inventoryItemId}
          unitCode={line.unitCode}
          dimensionUnit={units.length}
          onAdd={(pasted) => onChange([...line.slabs, ...pasted])}
          onClose={() => setPanel(null)}
        />
      )}
      {panel === 'apply' && (
        <ApplyToAllPanel
          slabCount={count}
          dimensionUnit={units.length}
          onApply={(fields) => onChange(line.slabs.map((s) => ({ ...s, ...fields })))}
          onClose={() => setPanel(null)}
        />
      )}

      {panel === 'bin' && (
        <BulkBinPanel slabs={line.slabs} bins={bins} onApply={assignBinToSlabs} onClose={() => setPanel(null)} />
      )}

      {groups.length > 0 && (
        <>
          <SlabGroupTable rows={groupView.items} bins={bins} units={units} actions={groupActions} />
          <SlabPager noun="groups" page={groupView} onPage={setGroupPage} />
        </>
      )}
      {listed.length > 0 && (
        <>
          {grouped && (
            <p className="mb-1 mt-3 text-2xs font-semibold uppercase tracking-wide text-stone-500">Slabs edited one by one</p>
          )}
          <SlabIndividualTable entries={slabView.items} serials={serials} bins={bins} units={units} actions={rowActions} />
          <SlabPager noun="slabs" page={slabView} onPage={setSlabPage} />
        </>
      )}

      {problems.length > 0 && (
        <ul role="alert" className="mt-2 space-y-0.5 text-2xs text-destructive">
          {problems.map((p) => <li key={p}>{p}</li>)}
        </ul>
      )}
    </div>
  );
}
