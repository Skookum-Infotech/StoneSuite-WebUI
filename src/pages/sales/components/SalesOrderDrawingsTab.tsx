import { useRef, useState, useCallback } from 'react';
import { Plus, Trash2, X, FileImage, Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import {
  DRAWING_TYPE_LABELS, DRAWING_STATUS_CONFIG,
  type SODrawing, type DrawingType, type DrawingStatus,
} from '@/lib/salesOrderForm';

// NOTE: Drawings are local-only UI state for now — there is no backend
// `sales_order_drawing` concept yet (unlike Files, which rides the real
// generic attachment API). Entries here are lost on navigation away; this
// mirrors the pre-existing mocked behavior, not a regression.

const inlineCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300 transition-all';

const DRAWING_TYPES: DrawingType[] = ['floor_plan', 'elevation', 'section', 'detail', 'fabrication', 'installation', 'shop_drawing', 'as_built', 'other'];
const DRAWING_STATUSES: DrawingStatus[] = ['draft', 'pending_review', 'approved', 'rejected'];

let drawingCounter = 0;
function genDrawingId() { drawingCounter += 1; return `drw-${drawingCounter}`; }

export function SalesOrderDrawingsTab({ drawings, onUpdate }: { drawings: SODrawing[]; onUpdate: (v: SODrawing[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Omit<SODrawing, 'id' | 'fileName' | 'fileSize' | 'uploadedBy' | 'uploadedAt'>>({
    name: '', type: 'fabrication', revision: 'Rev A', status: 'draft', notes: '',
  });

  const openAdd = useCallback(() => {
    setIsAdding(true); setEditId(null);
    setDraft({ name: '', type: 'fabrication', revision: 'Rev A', status: 'draft', notes: '' });
  }, []);

  const commitAdd = () => {
    if (!draft.name) return;
    onUpdate([...drawings, { ...draft, id: genDrawingId(), fileName: `${draft.name.replace(/\s+/g, '_')}.pdf`, fileSize: 0, uploadedBy: 'You', uploadedAt: new Date().toISOString() }]);
    setIsAdding(false);
  };

  const commitEdit = () => {
    if (!editId) return;
    onUpdate(drawings.map((d) => d.id === editId ? { ...d, ...draft } : d));
    setEditId(null);
  };

  const remove = (id: string) => { onUpdate(drawings.filter((d) => d.id !== id)); if (editId === id) setEditId(null); };
  const startEdit = (d: SODrawing) => { setEditId(d.id); setDraft({ name: d.name, type: d.type, revision: d.revision, status: d.status, notes: d.notes }); setIsAdding(false); };

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div onClick={() => fileRef.current?.click()}
        className="relative rounded-lg border-2 border-dashed border-stone-200 px-6 py-7 text-center cursor-pointer hover:border-stone-300 hover:bg-stone-50/50 transition-all duration-200 group">
        <input ref={fileRef} type="file" multiple accept=".pdf,.dwg,.dxf,.png,.jpg" className="sr-only" aria-label="Upload drawing files" />
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-stone-100 group-hover:bg-stone-200 mb-3 transition-colors">
          <Upload className="h-4.5 w-4.5 text-stone-400 group-hover:text-stone-600 transition-colors" />
        </div>
        <p className="text-xs font-medium text-stone-600 mb-1">Drop drawing files here or click to browse</p>
        <p className="text-2xs text-stone-400">PDF, DWG, DXF, PNG, JPG · CAD files, shop drawings, templates</p>
      </div>

      {/* Add form */}
      {isAdding && (
        <div className="rounded-lg border border-brand/30 bg-brand/5 p-4 space-y-3">
          <p className="text-xs font-semibold text-stone-700">New Drawing Entry</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1">
              <label className={fieldLabelCls}>Drawing Name *</label>
              <input autoFocus type="text" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} placeholder="e.g. Kitchen Countertop Plan" className={fieldCls} aria-label="Drawing Name" />
            </div>
            <div className="space-y-1">
              <label className={fieldLabelCls}>Type</label>
              <select value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value as DrawingType }))} className={fieldCls} aria-label="Drawing Type">
                {DRAWING_TYPES.map((t) => <option key={t} value={t}>{DRAWING_TYPE_LABELS[t]}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className={fieldLabelCls}>Revision</label>
              <input type="text" value={draft.revision} onChange={(e) => setDraft((p) => ({ ...p, revision: e.target.value }))} placeholder="Rev A" className={fieldCls} aria-label="Revision" />
            </div>
            <div className="space-y-1">
              <label className={fieldLabelCls}>Status</label>
              <select value={draft.status} onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value as DrawingStatus }))} className={fieldCls} aria-label="Status">
                {DRAWING_STATUSES.map((s) => <option key={s} value={s}>{DRAWING_STATUS_CONFIG[s].label}</option>)}
              </select>
            </div>
            <div className="space-y-1 sm:col-span-2">
              <label className={fieldLabelCls}>Notes</label>
              <input type="text" value={draft.notes} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="Optional notes…" className={fieldCls} aria-label="Notes" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={commitAdd} className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover transition-colors">
              <Plus className="size-3" /> Add Drawing
            </button>
            <button type="button" onClick={() => setIsAdding(false)} className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors">
              <X className="size-3" /> Cancel
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {drawings.length > 0 && (
        <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 border-b border-stone-200">
              <tr>
                {['Drawing Name', 'Type', 'Revision', 'Status', 'Notes', 'Date', ''].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {drawings.map((d) =>
                editId === d.id ? (
                  <tr key={d.id} className="bg-brand/5">
                    <td className="px-2 py-2"><input autoFocus type="text" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} className={cn(inlineCls, 'min-w-[150px]')} aria-label="Drawing Name" /></td>
                    <td className="px-2 py-2"><select value={draft.type} onChange={(e) => setDraft((p) => ({ ...p, type: e.target.value as DrawingType }))} className={cn(inlineCls, 'w-28')} aria-label="Type">{DRAWING_TYPES.map((t) => <option key={t} value={t}>{DRAWING_TYPE_LABELS[t]}</option>)}</select></td>
                    <td className="px-2 py-2"><input type="text" value={draft.revision} onChange={(e) => setDraft((p) => ({ ...p, revision: e.target.value }))} className={cn(inlineCls, 'w-20')} aria-label="Revision" /></td>
                    <td className="px-2 py-2"><select value={draft.status} onChange={(e) => setDraft((p) => ({ ...p, status: e.target.value as DrawingStatus }))} className={cn(inlineCls, 'w-28')} aria-label="Status">{DRAWING_STATUSES.map((s) => <option key={s} value={s}>{DRAWING_STATUS_CONFIG[s].label}</option>)}</select></td>
                    <td className="px-2 py-2"><input type="text" value={draft.notes} onChange={(e) => setDraft((p) => ({ ...p, notes: e.target.value }))} placeholder="Notes…" className={cn(inlineCls, 'min-w-[100px]')} aria-label="Notes" /></td>
                    <td className="px-3 py-2 text-stone-400 text-2xs whitespace-nowrap">{new Date(d.uploadedAt).toLocaleDateString()}</td>
                    <td className="px-2 py-2">
                      <div className="flex gap-1">
                        <button type="button" onClick={commitEdit} className="rounded bg-brand px-2 py-1 text-2xs font-semibold text-stone-900 hover:bg-brand-hover transition-colors">Save</button>
                        <button type="button" onClick={() => setEditId(null)} className="rounded border border-stone-200 bg-white px-2 py-1 text-2xs text-stone-600 hover:bg-stone-50 transition-colors">Cancel</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={d.id} className="hover:bg-stone-50/70 cursor-pointer group transition-colors" onClick={() => startEdit(d)}>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded bg-stone-100 flex items-center justify-center shrink-0">
                          <FileImage className="h-3.5 w-3.5 text-stone-400" />
                        </div>
                        <span className="font-medium text-stone-800">{d.name}</span>
                      </div>
                    </td>
                    <td className="px-3 py-2.5 text-stone-500">{DRAWING_TYPE_LABELS[d.type]}</td>
                    <td className="px-3 py-2.5 font-mono text-2xs text-stone-500">{d.revision}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-2xs font-semibold', DRAWING_STATUS_CONFIG[d.status].bg, DRAWING_STATUS_CONFIG[d.status].text)}>
                        {DRAWING_STATUS_CONFIG[d.status].label}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-stone-500 max-w-[160px] truncate">{d.notes || <span className="text-stone-300">—</span>}</td>
                    <td className="px-3 py-2.5 text-stone-400 text-2xs whitespace-nowrap">{new Date(d.uploadedAt).toLocaleDateString()}</td>
                    <td className="px-2 py-2.5 opacity-0 group-hover:opacity-100">
                      <button type="button" onClick={(e) => { e.stopPropagation(); remove(d.id); }} className="text-stone-300 hover:text-destructive transition-colors" aria-label="Remove drawing">
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
      {!drawings.length && !isAdding && (
        <p className="py-2 text-center text-xs text-stone-400 italic">No drawings attached yet.</p>
      )}
      {!isAdding && (
        <button type="button" onClick={openAdd} className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors">
          <Plus className="size-3" /> Add Drawing Entry
        </button>
      )}
    </div>
  );
}
