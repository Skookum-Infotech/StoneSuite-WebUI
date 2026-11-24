// The Inventory dialog's table: the slabs of one item the sales order can use, with a
// photo, serial, size, area, bin and status, and an Add button. A slab the drawing
// already has shows as Added.

import { Check, Image as ImageIcon, Plus } from 'lucide-react';
import type { DrawingSlabUnit } from '@/types/drawingSlab';
import { canAddToDrawing, isAwaitingInspection, isOnOrderDrawing } from '@/lib/drawing/slabHolds';
import { formatLength } from '@/lib/drawing/units';
import { formatUnitArea } from '@/lib/unitConsumption';
import { useDrawingEditor } from './DrawingEditorContext';

import { buttonVariants } from '@/components/ui/button';
const AWAITING_INSPECTION_HINT = 'This slab has not been inspected yet. Accept it on its Inventory page, then add it here.';

const HEADERS = ['Photo', 'Serial', 'Size (L × W × T)', 'Area', 'Bin', 'Status', ''];

interface SlabOptionsTableProps {
  units: DrawingSlabUnit[];
  /** The slab being added right now, or null. */
  addingId: string | null;
  onAdd: (slabId: string) => void;
}

export function SlabOptionsTable({ units, addingId, onAdd }: SlabOptionsTableProps) {
  const { state } = useDrawingEditor();
  const { salesOrderId, displayUnit, fractionDenominator } = state.present;
  const length = (mm: number) => formatLength(mm, displayUnit, fractionDenominator);

  return (
    <table className="w-full text-left type-cell">
      <thead>
        <tr className="border-b border-stone-200 type-th">
          {HEADERS.map((h, i) => <th key={h || `action-${i}`} scope="col" className="type-th px-2 py-1.5">{h}</th>)}
        </tr>
      </thead>
      <tbody>
        {units.map((unit) => {
          const added = isOnOrderDrawing(unit, salesOrderId);
          return (
            <tr key={unit.id} className="border-b border-stone-100 align-middle">
              <td className="px-2 py-1.5">
                <div className="flex h-10 w-14 items-center justify-center overflow-hidden rounded border border-stone-200 bg-stone-50">
                  {unit.photoUrl
                    ? <img src={unit.photoUrl} alt={`Slab ${unit.serial}`} className="h-full w-full object-cover" />
                    : <ImageIcon className="size-4 text-stone-300" aria-label="No photo" />}
                </div>
              </td>
              <td className="type-cell px-2 py-1.5 font-medium">
                {unit.serial}
                {unit.kind === 'remnant' && <span className="ml-1.5 rounded bg-stone-100 px-1 py-0.5 text-micro font-normal text-ink">Remnant</span>}
              </td>
              <td className="type-cell px-2 py-1.5">{length(unit.lengthMm)} × {length(unit.widthMm)} × {length(unit.thicknessMm)}</td>
              <td className="type-cell px-2 py-1.5">{formatUnitArea(unit.area, unit.areaUnitCode)}</td>
              <td className="type-cell px-2 py-1.5">{unit.binPath || '—'}</td>
              <td className="type-cell px-2 py-1.5 capitalize">{added ? 'On this order' : isAwaitingInspection(unit) ? 'Awaiting inspection' : unit.status.replace('_', ' ')}</td>
              <td className="px-2 py-1.5 text-right">
                {added ? (
                  <span className="inline-flex items-center gap-1 text-micro font-semibold text-success-ink">
                    <Check className="size-3.5" aria-hidden="true" /> Added
                  </span>
                ) : (
                  <button
                    type="button"
                    aria-label={`Add slab ${unit.serial}`}
                    disabled={!canAddToDrawing(unit) || addingId !== null}
                    title={isAwaitingInspection(unit) ? AWAITING_INSPECTION_HINT : undefined}
                    onClick={() => onAdd(unit.id)}
                    className={buttonVariants({ size: 'sm' })}
                  >
                    <Plus className="size-3" aria-hidden="true" />
                    {addingId === unit.id ? 'Adding…' : 'Add'}
                  </button>
                )}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
