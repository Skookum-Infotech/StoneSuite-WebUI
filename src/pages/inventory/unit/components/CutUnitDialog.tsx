import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Scissors, X, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { ReasonSelect } from '@/components/inventory/ReasonSelect';
import type { InventoryUnit, CutPiece, CutResult } from '@/types/inventory';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
let seq = 0;
function nextKey() { seq += 1; return `piece-${seq}`; }

interface DraftPiece extends CutPiece { key: string }

// Cuts a slab into the offcuts being kept. Material that leaves inventory as
// a finished countertop is never listed here — it leaves with the parent
// (spec §4). No area input: it's computed server-side from mm dimensions.
export function CutUnitDialog({ unit, onClose, onCut }: {
  unit: InventoryUnit;
  onClose: () => void;
  onCut: (result: CutResult) => void;
}) {
  const contentRef = useModalDialog(onClose);
  const queryClient = useQueryClient();
  const { lookups } = useInventoryLookups();

  const [pieces, setPieces] = useState<DraftPiece[]>([{ key: nextKey(), serial: '', lengthMm: 0, widthMm: 0, grade: '' }]);
  const [minLength, setMinLength] = useState('0');
  const [minWidth, setMinWidth] = useState('0');
  const [reasonId, setReasonId] = useState('');
  const [note, setNote] = useState('');

  function updatePiece(key: string, patch: Partial<DraftPiece>) {
    setPieces((ps) => ps.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  }
  function addPiece() {
    setPieces((ps) => [...ps, { key: nextKey(), serial: '', lengthMm: 0, widthMm: 0, grade: '' }]);
  }
  function removePiece(key: string) {
    setPieces((ps) => ps.filter((p) => p.key !== key));
  }

  const { mutate: cut, isPending, error } = useMutation({
    mutationFn: () => inventoryUnitService.cut(unit.id, {
      remnants: pieces
        .filter((p) => p.serial.trim())
        .map(({ key: _key, ...rest }) => rest),
      minUsableLengthMm: Number(minLength) || 0,
      minUsableWidthMm: Number(minWidth) || 0,
      reasonId: reasonId ? Number(reasonId) : null,
      note: note || undefined,
    }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-unit', unit.id] });
      onCut(result);
      onClose();
    },
  });

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px] p-4" role="dialog" aria-modal="true" aria-labelledby="cut-unit-title" onClick={(e) => e.target === e.currentTarget && !isPending && onClose()}>
      <div ref={contentRef} tabIndex={-1} className="w-full max-w-lg max-h-[85vh] overflow-y-auto modal-scrollbar rounded-xl bg-white p-6 shadow-2xl outline-none">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
              <Scissors className="size-4 text-accent-foreground" />
            </div>
            <div>
              <h3 id="cut-unit-title" className="type-card-title">Cut Slab</h3>
              <p className="mt-0.5 type-helper">{unit.serial} · {unit.area.toFixed(2)} sq</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-stone-400 hover:bg-stone-100"><X className="size-4" /></button>
        </div>

        <p className="mb-3 type-helper">
          List only the offcuts you are keeping — material cut into a finished countertop leaves inventory with the parent and is not listed here.
        </p>

        <div className="space-y-3">
          {pieces.map((p, i) => (
            <div key={p.key} className="rounded-lg border border-stone-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-micro font-semibold text-stone-500">Offcut {i + 1}</span>
                {pieces.length > 1 && (
                  <button type="button" onClick={() => removePiece(p.key)} aria-label={`Remove offcut ${i + 1}`} className="text-stone-400 hover:text-danger-ink"><Trash2 className="size-3.5" /></button>
                )}
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="text" value={p.serial} onChange={(e) => updatePiece(p.key, { serial: e.target.value })} placeholder="Serial" aria-label={`Offcut ${i + 1} serial`} className="h-9 px-2.5 border border-stone-300 rounded-lg type-input" />
                <input type="text" value={p.grade ?? ''} onChange={(e) => updatePiece(p.key, { grade: e.target.value })} placeholder="Grade (optional)" aria-label={`Offcut ${i + 1} grade`} className="h-9 px-2.5 border border-stone-300 rounded-lg type-input" />
                <input type="number" min={0} value={p.lengthMm || ''} onChange={(e) => updatePiece(p.key, { lengthMm: Number(e.target.value) || 0 })} placeholder="Length (mm)" aria-label={`Offcut ${i + 1} length mm`} className="h-9 px-2.5 border border-stone-300 rounded-lg type-input" />
                <input type="number" min={0} value={p.widthMm || ''} onChange={(e) => updatePiece(p.key, { widthMm: Number(e.target.value) || 0 })} placeholder="Width (mm)" aria-label={`Offcut ${i + 1} width mm`} className="h-9 px-2.5 border border-stone-300 rounded-lg type-input" />
              </div>
            </div>
          ))}
          <button type="button" onClick={addPiece} className={cn(buttonVariants({ variant: 'outline' }), 'flex w-full')}>
            <Plus className="size-3.5" /> Add offcut
          </button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="block type-field-label">Min usable length (mm)</label>
            <input type="number" min={0} value={minLength} onChange={(e) => setMinLength(e.target.value)} className="w-full h-9 px-2.5 border border-stone-300 rounded-lg type-input" aria-label="Minimum usable length mm" />
          </div>
          <div className="space-y-1.5">
            <label className="block type-field-label">Min usable width (mm)</label>
            <input type="number" min={0} value={minWidth} onChange={(e) => setMinWidth(e.target.value)} className="w-full h-9 px-2.5 border border-stone-300 rounded-lg type-input" aria-label="Minimum usable width mm" />
          </div>
        </div>
        <p className="mt-1 type-helper">Pieces under this shop policy are still created but born scrapped — 0 keeps everything.</p>

        <div className="mt-3 space-y-1.5">
          <label className="block type-field-label">Reason</label>
          <ReasonSelect reasons={lookups?.reasons ?? []} value={reasonId} onChange={setReasonId} required={false} />
        </div>
        <div className="mt-3 space-y-1.5">
          <label className="block type-field-label">Note</label>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. island top" className="w-full h-9 px-2.5 border border-stone-300 rounded-lg type-input" aria-label="Cut note" />
        </div>

        {error && <p className="mt-3 type-error">{apiErrorMessage(error, 'Failed to cut slab.')}</p>}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} disabled={isPending} className={buttonVariants({ variant: 'outline' })}>Cancel</button>
          <button type="button" onClick={() => cut()} disabled={isPending} className={cn(buttonVariants(), 'active:scale-95')}>
            {isPending ? 'Cutting…' : 'Cut Slab'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
