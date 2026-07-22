import { useState } from 'react';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EMPTY_PIECE_ROW, type FJPieceRow } from '@/lib/fabricationForm';

const inlineCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300 transition-all';

let rowCounter = 0;
function genId() { rowCounter += 1; return `piece-${rowCounter}`; }

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

// Editable pieces list — Add page only. The backend has no endpoint to add or
// edit pieces after a job exists (Update is header-only, spec §2 "not yet
// done"), so pieces are locked in at create time; the Edit and Detail pages
// render the same rows read-only via FabricationPiecesTable instead.
export function FabricationPiecesEditor({ pieces, onUpdate, sourceOrderItems = [] }: {
  pieces: FJPieceRow[];
  onUpdate: (v: FJPieceRow[]) => void;
  sourceOrderItems?: { id: string; label: string }[];
}) {
  const [draft, setDraft] = useState<Omit<FJPieceRow, 'id' | 'pieceNumber'>>(EMPTY_PIECE_ROW);
  const [editId, setEditId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const updateDraft = (key: keyof typeof draft, val: string) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  };

  const commitAdd = () => {
    if (!draft.pieceName) return;
    onUpdate([...pieces, { ...draft, id: genId(), pieceNumber: pieces.length + 1 }]);
    setDraft(EMPTY_PIECE_ROW);
    setIsAdding(false);
  };

  const commitEdit = () => {
    if (!editId) return;
    onUpdate(pieces.map((r) => r.id === editId ? { ...draft, id: editId, pieceNumber: r.pieceNumber } : r));
    setEditId(null);
    setDraft(EMPTY_PIECE_ROW);
  };

  const startEdit = (row: FJPieceRow) => {
    setEditId(row.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, pieceNumber, ...rest } = row;
    setDraft(rest);
    setIsAdding(false);
  };

  const remove = (id: string) => {
    const next = pieces.filter((r) => r.id !== id).map((r, i) => ({ ...r, pieceNumber: i + 1 }));
    onUpdate(next);
    if (editId === id) { setEditId(null); setDraft(EMPTY_PIECE_ROW); }
  };

  const activeDraft = isAdding || editId !== null;

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
            {pieces.map((row) =>
              editId === row.id ? (
                <tr key={row.id} className="bg-brand/5 divide-x divide-stone-100">
                  <InlineRow pieceNumber={row.pieceNumber} draft={draft} onChange={updateDraft} sourceOrderItems={sourceOrderItems} />
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={() => remove(row.id)} className="text-stone-300 hover:text-destructive transition-colors" aria-label="Remove piece">
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className="hover:bg-stone-50/70 transition-colors group divide-x divide-stone-100">
                  <td className="px-2.5 py-2.5 text-stone-400 tabular-nums">{row.pieceNumber}</td>
                  <td className="px-2.5 py-2.5 font-medium text-stone-800">{row.pieceName || <span className="text-stone-300">—</span>}</td>
                  <td className="px-2.5 py-2.5 text-stone-500">{row.pieceType || '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">{row.lengthMm || '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">{row.widthMm || '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">{row.thicknessMm || '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-500">{row.sinkCutoutCount || '0'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-500">{row.cooktopCutoutCount || '0'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-500">{row.seamCount || '0'}</td>
                  <td className="px-2.5 py-2.5 text-stone-500 truncate max-w-[160px]">
                    {sourceOrderItems.find((i) => i.id === row.salesOrderItemUuid)?.label ?? '—'}
                  </td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1.5">
                      <button type="button" onClick={() => startEdit(row)} className="text-stone-500 hover:text-stone-700 transition-colors" aria-label={`Edit piece ${row.pieceName || row.pieceNumber}`}>
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => remove(row.id)} className="text-stone-500 hover:text-destructive transition-colors" aria-label={`Remove piece ${row.pieceName || row.pieceNumber}`}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {isAdding && (
              <tr className="bg-brand/5 divide-x divide-stone-100">
                <InlineRow pieceNumber={pieces.length + 1} draft={draft} onChange={updateDraft} sourceOrderItems={sourceOrderItems} />
                <td className="px-2 py-1.5" />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pieces.length === 0 && !isAdding && (
        <div className="flex flex-col items-center gap-1.5 py-8 text-center">
          <p className="text-xs text-stone-400">No pieces added yet.</p>
          <p className="text-2xs text-stone-300">Click <strong className="text-stone-500">+ Add Piece</strong> to add one.</p>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 bg-stone-50/50 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (isAdding) commitAdd();
            else if (editId) commitEdit();
            else { setIsAdding(true); setEditId(null); setDraft(EMPTY_PIECE_ROW); }
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover transition-colors"
        >
          <Plus className="size-3" />
          {isAdding || editId ? 'Save Piece' : 'Add Piece'}
        </button>
        {activeDraft && (
          <button type="button" onClick={() => { setIsAdding(false); setEditId(null); setDraft(EMPTY_PIECE_ROW); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            <X className="size-3" /> Cancel
          </button>
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
