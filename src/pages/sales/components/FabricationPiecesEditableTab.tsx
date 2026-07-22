import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fabricationService } from '@/services/fabricationService';
import { apiErrorMessage } from '@/api/tenantClient';
import { EMPTY_PIECE_ROW, toPieceInput, pieceToRow, type FJPieceRow } from '@/lib/fabricationForm';
import type { FabricationJobPiece } from '@/types/fabrication';

const inlineCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300 transition-all';

const COLS = [
  { label: '#', w: 'w-8' },
  { label: 'Piece Name *', w: 'min-w-[120px]' },
  { label: 'Type', w: 'min-w-[100px]' },
  { label: 'Length (mm)', w: 'w-24', right: true },
  { label: 'Width (mm)', w: 'w-24', right: true },
  { label: 'Thickness (mm)', w: 'w-24', right: true },
  { label: 'Sinks', w: 'w-16', right: true },
  { label: 'Cooktops', w: 'w-16', right: true },
  { label: 'Seams', w: 'w-16', right: true },
  { label: 'Sales Order Line', w: 'min-w-[160px]' },
  { label: '', w: 'w-8' },
];

// Server-backed pieces editor for the Edit and Detail pages — used instead of
// the read-only FabricationPiecesTable while canEditPieces(job.statusCode) is
// true. Unlike FabricationPiecesEditor (the create-time, purely local-state
// version), every add/edit/remove here is its own API call against the new
// POST/PATCH/DELETE .../pieces[/{pieceUuid}] routes, and the job query is
// invalidated after each so `pieces` (passed down from the loaded job)
// reflects the server's own numbering/state rather than anything computed
// client-side.
export function FabricationPiecesEditableTab({ jobId, pieces, sourceOrderItems }: {
  jobId: string;
  pieces: FabricationJobPiece[];
  sourceOrderItems: { id: string; label: string }[];
}) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState<Omit<FJPieceRow, 'id' | 'pieceNumber'>>(EMPTY_PIECE_ROW);
  const [editId, setEditId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['fabrication-job', jobId] });
  }

  const addMutation = useMutation({
    mutationFn: () => fabricationService.addPiece(jobId, toPieceInput({ ...draft, id: '', pieceNumber: 0 })),
    onSuccess: () => {
      invalidate();
      setDraft(EMPTY_PIECE_ROW);
      setIsAdding(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: (piece: FabricationJobPiece) =>
      fabricationService.updatePiece(jobId, piece.id, toPieceInput({ ...draft, id: piece.id, pieceNumber: piece.pieceNumber })),
    onSuccess: () => {
      invalidate();
      setEditId(null);
      setDraft(EMPTY_PIECE_ROW);
    },
  });

  const removeMutation = useMutation({
    mutationFn: (pieceId: string) => fabricationService.removePiece(jobId, pieceId),
    onSuccess: (_void, pieceId) => {
      invalidate();
      if (editId === pieceId) { setEditId(null); setDraft(EMPTY_PIECE_ROW); }
    },
  });

  const updateDraft = (key: keyof typeof draft, val: string) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  };

  function startEdit(piece: FabricationJobPiece) {
    const { id: _id, pieceNumber: _pieceNumber, ...rest } = pieceToRow(piece);
    setDraft(rest);
    setEditId(piece.id);
    setIsAdding(false);
  }

  function cancelDraft() {
    setIsAdding(false);
    setEditId(null);
    setDraft(EMPTY_PIECE_ROW);
  }

  const activeDraft = isAdding || editId !== null;
  const activeError = addMutation.error ?? updateMutation.error ?? removeMutation.error;
  const savePending = addMutation.isPending || updateMutation.isPending;

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      <div className="overflow-x-auto modal-scrollbar">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr className="divide-x divide-stone-200">
              {COLS.map((c) => (
                <th key={c.label} className={cn('px-2.5 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap', c.w, c.right && 'text-right')}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {pieces.map((piece) =>
              editId === piece.id ? (
                <tr key={piece.id} className="bg-brand/5 divide-x divide-stone-100">
                  <InlineRow pieceNumber={piece.pieceNumber} draft={draft} onChange={updateDraft} sourceOrderItems={sourceOrderItems} />
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={cancelDraft} className="text-stone-300 hover:text-stone-600 transition-colors" aria-label={`Cancel editing piece ${piece.pieceName || piece.pieceNumber}`}>
                      <X className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={piece.id} className="hover:bg-stone-50/70 transition-colors group divide-x divide-stone-100">
                  <td className="px-2.5 py-2.5 text-stone-400 tabular-nums">{piece.pieceNumber}</td>
                  <td className="px-2.5 py-2.5 font-medium text-stone-800">{piece.pieceName || <span className="text-stone-300">—</span>}</td>
                  <td className="px-2.5 py-2.5 text-stone-500">{piece.pieceType || '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">{piece.lengthMm || '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">{piece.widthMm || '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">{piece.thicknessMm || '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-500">{piece.sinkCutoutCount || '0'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-500">{piece.cooktopCutoutCount || '0'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-500">{piece.seamCount || '0'}</td>
                  <td className="px-2.5 py-2.5 text-stone-500 truncate max-w-[160px]">
                    {sourceOrderItems.find((i) => i.id === piece.salesOrderItemUuid)?.label ?? '—'}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => startEdit(piece)} className="text-stone-500 hover:text-stone-700 transition-colors" aria-label={`Edit piece ${piece.pieceName || piece.pieceNumber}`}>
                        <Pencil className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeMutation.mutate(piece.id)}
                        disabled={removeMutation.isPending && removeMutation.variables === piece.id}
                        className="text-stone-500 hover:text-destructive transition-colors disabled:opacity-50"
                        aria-label={`Remove piece ${piece.pieceName || piece.pieceNumber}`}
                      >
                        {removeMutation.isPending && removeMutation.variables === piece.id
                          ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {isAdding && (
              <tr className="bg-brand/5 divide-x divide-stone-100">
                <InlineRow pieceNumber={pieces.length + 1} draft={draft} onChange={updateDraft} sourceOrderItems={sourceOrderItems} />
                <td className="px-2 py-1.5">
                  <button type="button" onClick={cancelDraft} className="text-stone-300 hover:text-stone-600 transition-colors" aria-label="Cancel new piece">
                    <X className="size-3.5" />
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pieces.length === 0 && !isAdding && (
        <div className="flex flex-col items-center gap-1.5 py-8 text-center">
          <p className="text-xs text-stone-400">No pieces on this job yet.</p>
          <p className="text-2xs text-stone-300">Click <strong className="text-stone-500">+ Add Piece</strong> to add one.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 bg-stone-50/50 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (isAdding) addMutation.mutate();
            else if (editId) {
              const piece = pieces.find((p) => p.id === editId);
              if (piece) updateMutation.mutate(piece);
            } else {
              setIsAdding(true);
              setEditId(null);
              setDraft(EMPTY_PIECE_ROW);
            }
          }}
          disabled={savePending || (activeDraft && !draft.pieceName)}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-colors"
        >
          {savePending ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
          {activeDraft ? (savePending ? 'Saving…' : 'Save Piece') : 'Add Piece'}
        </button>
        {activeDraft && !savePending && (
          <button type="button" onClick={cancelDraft}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            <X className="size-3" /> Cancel
          </button>
        )}
        {activeError && (
          <p className="text-2xs text-destructive w-full">{apiErrorMessage(activeError, 'Failed to save piece.')}</p>
        )}
      </div>
    </div>
  );
}

function InlineRow({ pieceNumber, draft, onChange, sourceOrderItems }: {
  pieceNumber: number;
  draft: Omit<FJPieceRow, 'id' | 'pieceNumber'>;
  onChange: (key: keyof typeof draft, val: string) => void;
  sourceOrderItems: { id: string; label: string }[];
}) {
  return (
    <>
      <td className="px-2.5 py-1.5 text-stone-400 tabular-nums">{pieceNumber}</td>
      <td className="px-2 py-1.5"><input autoFocus type="text" value={draft.pieceName} onChange={(e) => onChange('pieceName', e.target.value)} placeholder="Island Top" className={cn(inlineCls, 'min-w-[110px]')} aria-label="Piece Name" /></td>
      <td className="px-2 py-1.5"><input type="text" value={draft.pieceType} onChange={(e) => onChange('pieceType', e.target.value)} placeholder="countertop" className={cn(inlineCls, 'min-w-[90px]')} aria-label="Piece Type" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" step="0.1" value={draft.lengthMm} onChange={(e) => onChange('lengthMm', e.target.value)} placeholder="0" className={cn(inlineCls, 'w-20 text-right')} aria-label="Length mm" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" step="0.1" value={draft.widthMm} onChange={(e) => onChange('widthMm', e.target.value)} placeholder="0" className={cn(inlineCls, 'w-20 text-right')} aria-label="Width mm" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" step="0.1" value={draft.thicknessMm} onChange={(e) => onChange('thicknessMm', e.target.value)} placeholder="0" className={cn(inlineCls, 'w-20 text-right')} aria-label="Thickness mm" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" value={draft.sinkCutoutCount} onChange={(e) => onChange('sinkCutoutCount', e.target.value)} className={cn(inlineCls, 'w-14 text-right')} aria-label="Sink cutouts" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" value={draft.cooktopCutoutCount} onChange={(e) => onChange('cooktopCutoutCount', e.target.value)} className={cn(inlineCls, 'w-14 text-right')} aria-label="Cooktop cutouts" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" value={draft.seamCount} onChange={(e) => onChange('seamCount', e.target.value)} className={cn(inlineCls, 'w-14 text-right')} aria-label="Seams" /></td>
      <td className="px-2 py-1.5">
        <select value={draft.salesOrderItemUuid ?? ''} onChange={(e) => onChange('salesOrderItemUuid', e.target.value)} className={cn(inlineCls, 'min-w-[150px]')} aria-label="Linked sales order line">
          <option value="">— Not linked —</option>
          {sourceOrderItems.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
      </td>
    </>
  );
}
