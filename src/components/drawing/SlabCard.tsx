// One slab on the Material tab: its name and size, Select Pieces and Delete, and the
// slab itself with the pieces laid on it. Delete gives the slab back to inventory and
// takes its pieces off it.

import { useState } from 'react';
import { Crosshair, Trash2 } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import type { DrawingSlabUnit } from '@/types/drawingSlab';
import { isHandedToJob } from '@/lib/drawing/slabHolds';
import { formatLength } from '@/lib/drawing/units';
import { formatUnitArea } from '@/lib/unitConsumption';
import { cn } from '@/lib/utils';
import { useDrawingEditor } from './DrawingEditorContext';
import { useMaterialPicker } from './MaterialPickerContext';
import { SlabCanvas } from './SlabCanvas';
import { useOrderSlabs } from './useOrderSlabs';

const JOB_HAS_SLAB_HINT = 'A fabrication job has taken this slab. Release it from the job to give it back.';

export function SlabCard({ slab }: { slab: DrawingSlabUnit }) {
  const { state, dispatch } = useDrawingEditor();
  const { pickingSlab, startPicking, stopPicking } = useMaterialPicker();
  const { removeSlab } = useOrderSlabs(state.present.salesOrderId);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const { displayUnit, fractionDenominator } = state.present;
  const picking = pickingSlab?.id === slab.id;
  const handedToJob = isHandedToJob(slab);
  const name = [slab.inventoryItemName, slab.serial].filter(Boolean).join(' ');
  const size = `${formatLength(slab.lengthMm, displayUnit, fractionDenominator)} × ${formatLength(slab.widthMm, displayUnit, fractionDenominator)}`;

  const onSlab = state.present.areas.flatMap((area) => area.pieces
    .filter((piece) => piece.slab?.slabId === slab.id)
    .map((piece) => ({ areaId: area.id, pieceId: piece.id })));

  async function deleteSlab() {
    setBusy(true);
    setError(null);
    try {
      await removeSlab(slab.id);
      // The slab is no longer the order's, so nothing may stay laid on it.
      onSlab.forEach(({ areaId, pieceId }) => dispatch({ type: 'updatePiece', areaId, pieceId, patch: { slab: undefined } }));
      if (picking) stopPicking();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not give the slab back.'));
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  function onDeleteClick() {
    if (onSlab.length > 0 && !confirming) {
      setConfirming(true);
      return;
    }
    void deleteSlab();
  }

  return (
    <section aria-label={`Slab ${slab.serial}`} className="rounded-lg border border-stone-200 bg-white p-2.5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
        <p className="min-w-0 text-xs text-stone-700">
          <span className="font-semibold text-stone-900">{name}</span>
          <span>, {size} = {formatUnitArea(slab.area, slab.areaUnitCode)}</span>
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            aria-pressed={picking}
            aria-label={picking ? `Stop selecting pieces for slab ${slab.serial}` : `Select pieces for slab ${slab.serial}`}
            onClick={() => (picking ? stopPicking() : startPicking(slab))}
            className={cn(
              'inline-flex items-center gap-1 rounded px-2 py-1 text-2xs font-semibold transition-colors',
              picking ? 'bg-stone-900 text-white' : 'bg-brand text-stone-900 hover:bg-brand-hover',
            )}
          >
            <Crosshair className="size-3" aria-hidden="true" />
            {picking ? 'Done' : 'Select Pieces'}
          </button>
          <button
            type="button"
            aria-label={`Delete slab ${slab.serial}`}
            title={handedToJob ? JOB_HAS_SLAB_HINT : 'Give the slab back to inventory'}
            disabled={handedToJob || busy}
            onClick={onDeleteClick}
            className="rounded p-1 text-stone-500 hover:bg-destructive/10 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {confirming && (
        <div role="alert" className="mb-2 flex flex-wrap items-center gap-2 rounded border border-amber-200 bg-amber-50 px-2 py-1.5 text-2xs text-amber-900">
          <span className="min-w-0 flex-1">
            Give this slab back and take {onSlab.length} piece{onSlab.length === 1 ? '' : 's'} off it?
          </span>
          <button type="button" disabled={busy} onClick={() => void deleteSlab()} className="rounded bg-destructive px-2 py-0.5 font-semibold text-white disabled:opacity-50">
            Delete slab
          </button>
          <button type="button" onClick={() => setConfirming(false)} className="rounded border border-stone-300 bg-white px-2 py-0.5 font-medium text-stone-700">
            Cancel
          </button>
        </div>
      )}
      {error && <p role="alert" className="mb-2 text-2xs text-destructive">{error}</p>}
      {handedToJob && <p className="mb-2 text-2xs text-stone-500">{JOB_HAS_SLAB_HINT}</p>}

      <SlabCanvas slab={slab} />
    </section>
  );
}
