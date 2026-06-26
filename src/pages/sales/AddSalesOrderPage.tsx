import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, AlertCircle, Loader2, Save, Plus, Trash2,
  Copy, X, FileImage, Upload,
} from 'lucide-react';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import { ModernSection, ModernFieldShell, FormActionBar } from '@/components/crm/FormPrimitives';
import {
  fieldCls, textareaCls, readonlyCls, fieldLabelCls, checkboxLabelCls,
} from '@/components/crm/formUtils';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import {
  PRIMARY_INFO_FIELDS, BILL_TO_FIELDS, SHIP_TO_FIELDS, SALES_INFO_FIELDS,
  soDefaults,
  type SOFormField,
  type SOLineItem, type SOInventoryItem, type SODrawing,
  type DrawingType, type DrawingStatus,
  EMPTY_LINE_ITEM, calcLineItem,
  DRAWING_TYPE_LABELS, DRAWING_STATUS_CONFIG,
} from '@/lib/salesOrderForm';

// ── Page-level tabs ───────────────────────────────────────────────────────────

const PAGE_TABS = [
  { key: 'details',   label: 'Details' },
  { key: 'inventory', label: 'Inventory' },
  { key: 'drawings',  label: 'Drawings' },
  { key: 'audit',     label: 'Audit' },
  { key: 'files',     label: 'Files' },
] as const;
type PageTab = (typeof PAGE_TABS)[number]['key'];

// ── Field renderer ────────────────────────────────────────────────────────────

function SOField({ field, value, set }: {
  field: SOFormField;
  value: unknown;
  set: (k: string, v: unknown) => void;
}) {
  const str     = typeof value === 'string' ? value : value === null ? '' : String(value);
  const checked = value === true;

  if (field.type === 'checkbox') {
    return (
      <div className="col-span-full flex items-center gap-3 py-1.5">
        <input
          type="checkbox"
          id={field.key}
          checked={checked}
          onChange={(e) => set(field.key, e.target.checked)}
          className="h-4 w-4 rounded border border-stone-300 accent-brand cursor-pointer shrink-0 bg-white [color-scheme:light]"
          aria-label={field.label}
        />
        <label htmlFor={field.key} className={`${checkboxLabelCls} cursor-pointer select-none`}>
          {field.label}
          {field.required && <span className="ml-0.5 text-destructive">*</span>}
        </label>
      </div>
    );
  }

  if (field.type === 'readonly') {
    return (
      <ModernFieldShell label={field.label}>
        <div className={`${readonlyCls} cursor-not-allowed select-none`}>
          {str || <span className="text-stone-400">—</span>}
        </div>
      </ModernFieldShell>
    );
  }

  if (field.type === 'textarea') {
    return (
      <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
        <ModernFieldShell label={field.label} required={field.required}>
          <textarea
            rows={field.rows ?? 3}
            required={field.required}
            value={str}
            onChange={(e) => set(field.key, e.target.value)}
            className={textareaCls}
            placeholder={field.placeholder}
            aria-label={field.label}
          />
        </ModernFieldShell>
      </div>
    );
  }

  if (field.type === 'select') {
    return (
      <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
        <ModernFieldShell label={field.label} required={field.required}>
          <select
            required={field.required}
            value={str}
            onChange={(e) => set(field.key, e.target.value)}
            className={fieldCls}
            aria-label={field.label}
          >
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt || '— Select —'}</option>
            ))}
          </select>
        </ModernFieldShell>
      </div>
    );
  }

  return (
    <div className={field.colSpanFull ? 'col-span-full' : field.colSpan2 ? 'sm:col-span-2' : ''}>
      <ModernFieldShell label={field.label} required={field.required}>
        <input
          type={field.type ?? 'text'}
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={fieldCls}
          placeholder={field.placeholder}
          aria-label={field.label}
        />
      </ModernFieldShell>
    </div>
  );
}

function SOSectionGrid({ fields, data, set, maxCols = 3 }: {
  fields: SOFormField[];
  data: Record<string, unknown>;
  set: (k: string, v: unknown) => void;
  maxCols?: 2 | 3;
}) {
  const visible = fields.filter((f) =>
    f.showIfFieldFalse ? !data[f.showIfFieldFalse] : true,
  );
  return (
    <div className={cn(
      'grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2',
      maxCols === 3 && 'lg:grid-cols-3',
    )}>
      {visible.map((f) => (
        <SOField key={f.key} field={f} value={data[f.key]} set={set} />
      ))}
    </div>
  );
}

// ── Summary card ─────────────────────────────────────────────────────────────

function SOSummaryCard({ subtotal, discountAmt, taxTotal, total }: {
  subtotal: number; discountAmt: number; taxTotal: number; total: number;
}) {
  const fmt = (n: number) =>
    '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const rows = [
    { label: 'Sub Total',  value: fmt(subtotal),    muted: true  },
    { label: 'Discount',   value: fmt(discountAmt), muted: true  },
    { label: 'Tax Total',  value: fmt(taxTotal),    muted: true  },
    { label: 'Total',      value: fmt(total),       muted: false },
  ];

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden sticky top-4">
      <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200">
        <p className="text-2xs font-semibold uppercase tracking-wide text-stone-500">Summary</p>
      </div>
      <div className="divide-y divide-stone-100">
        {rows.map(({ label, value, muted }) => (
          <div
            key={label}
            className={cn(
              'flex items-center justify-between px-4 py-2.5',
              !muted && 'bg-stone-50 border-t border-stone-200',
            )}
          >
            <span className={cn('text-xs', muted ? 'text-stone-500' : 'text-stone-700 font-medium')}>
              {label}
            </span>
            <span className={cn(
              'tabular-nums',
              muted ? 'text-xs font-semibold text-stone-600' : 'text-sm font-bold text-stone-900',
            )}>
              {value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Items sub-tab ─────────────────────────────────────────────────────────────

const inlineCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300 transition-all';

let rowCounter = 0;
function genId() { rowCounter += 1; return `li-${rowCounter}`; }

const ITEM_COLS = [
  { label: '#',           w: 'w-8' },
  { label: 'Item Name *', w: 'min-w-[130px]' },
  { label: 'Description', w: 'min-w-[140px]' },
  { label: 'SKU',         w: 'min-w-[100px]' },
  { label: 'Qty',         w: 'w-16' },
  { label: 'Units',       w: 'w-16' },
  { label: 'Unit Price',  w: 'w-20' },
  { label: 'Disc %',      w: 'w-16' },
  { label: 'Amount',      w: 'w-20' },
  { label: 'Tax %',       w: 'w-16' },
  { label: 'Total',       w: 'w-20' },
  { label: '',            w: 'w-8' },
];

function ItemsSubTab({ items, onUpdate }: { items: SOLineItem[]; onUpdate: (v: SOLineItem[]) => void }) {
  const [draft, setDraft]   = useState<Omit<SOLineItem, 'id' | 'lineNo'>>(EMPTY_LINE_ITEM);
  const [editId, setEditId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const updateDraft = (key: keyof typeof draft, val: string) => {
    setDraft((prev) => {
      const next = { ...prev, [key]: val };
      const { amount, total } = calcLineItem(next);
      return { ...next, amount, total };
    });
  };

  const commitAdd = () => {
    if (!draft.itemName) return;
    onUpdate([...items, { ...draft, id: genId(), lineNo: items.length + 1 }]);
    setDraft(EMPTY_LINE_ITEM);
    setIsAdding(false);
  };

  const commitEdit = () => {
    if (!editId) return;
    onUpdate(items.map((r) => r.id === editId ? { ...draft, id: editId, lineNo: r.lineNo } : r));
    setEditId(null);
    setDraft(EMPTY_LINE_ITEM);
  };

  const startEdit = (row: SOLineItem) => {
    setEditId(row.id);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, lineNo, ...rest } = row;
    setDraft(rest);
    setIsAdding(false);
  };

  const remove = (id: string) => {
    const next = items.filter((r) => r.id !== id).map((r, i) => ({ ...r, lineNo: i + 1 }));
    onUpdate(next);
    if (editId === id) { setEditId(null); setDraft(EMPTY_LINE_ITEM); }
  };

  const copyPrev = () => {
    if (!items.length) return;
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, lineNo, ...rest } = items[items.length - 1];
    setDraft(rest);
    setIsAdding(true);
    setEditId(null);
  };

  const activeDraft = isAdding || editId !== null;

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden">
      <div className="overflow-x-auto modal-scrollbar">
        <table className="w-full text-left text-xs">
          <thead className="bg-stone-50 border-b border-stone-200">
            <tr>
              {ITEM_COLS.map((c) => (
                <th key={c.label} className={cn('px-2.5 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap', c.w)}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((row) =>
              editId === row.id ? (
                <tr key={row.id} className="bg-brand/5">
                  <InlineItemRow lineNo={row.lineNo} draft={draft} onChange={updateDraft} />
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={() => remove(row.id)} className="text-stone-300 hover:text-destructive transition-colors" aria-label="Remove">
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className="hover:bg-stone-50/70 transition-colors cursor-pointer group" onClick={() => startEdit(row)}>
                  <td className="px-2.5 py-2.5 text-stone-400 tabular-nums">{row.lineNo}</td>
                  <td className="px-2.5 py-2.5 font-medium text-stone-800">{row.itemName || <span className="text-stone-300">—</span>}</td>
                  <td className="px-2.5 py-2.5 text-stone-500 max-w-[140px] truncate">{row.itemDescription}</td>
                  <td className="px-2.5 py-2.5 text-stone-500 font-mono text-2xs">{row.itemSku}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">{row.quantity}</td>
                  <td className="px-2.5 py-2.5 text-stone-500">{row.units}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">{row.unitPrice ? `$${parseFloat(row.unitPrice).toFixed(2)}` : '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-500">{row.discount ? `${row.discount}%` : '0%'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-700 font-medium">{row.amount ? `$${row.amount}` : '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-500">{row.tax ? `${row.tax}%` : '0%'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-800 font-semibold">{row.total ? `$${row.total}` : '—'}</td>
                  <td className="px-2 py-2.5 opacity-0 group-hover:opacity-100">
                    <button type="button" onClick={(e) => { e.stopPropagation(); remove(row.id); }} className="text-stone-300 hover:text-destructive transition-colors" aria-label="Remove">
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ),
            )}
            {isAdding && (
              <tr className="bg-brand/5">
                <InlineItemRow lineNo={items.length + 1} draft={draft} onChange={updateDraft} />
                <td className="px-2 py-1.5" />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length === 0 && !isAdding && (
        <div className="flex flex-col items-center gap-1.5 py-8 text-center">
          <p className="text-xs text-stone-400">No line items yet.</p>
          <p className="text-2xs text-stone-300">Click <strong className="text-stone-500">+ Add Line</strong> to add an item.</p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-t border-stone-100 bg-stone-50/50 px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (isAdding) commitAdd();
            else if (editId) commitEdit();
            else { setIsAdding(true); setEditId(null); setDraft(EMPTY_LINE_ITEM); }
          }}
          className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover transition-colors"
        >
          <Plus className="size-3" />
          {isAdding || editId ? 'Save Line' : '+ Add Line'}
        </button>
        {activeDraft && (
          <button type="button" onClick={() => { setIsAdding(false); setEditId(null); setDraft(EMPTY_LINE_ITEM); }}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            <X className="size-3" /> Cancel
          </button>
        )}
        <button type="button" onClick={copyPrev} disabled={items.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 transition-colors">
          <Copy className="size-3" /> Copy Previous
        </button>
        <button type="button" onClick={() => { if (items.length) remove(items[items.length - 1].id); }}
          disabled={items.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 transition-colors">
          <Trash2 className="size-3" /> Remove Last
        </button>
      </div>
    </div>
  );
}

function InlineItemRow({ lineNo, draft, onChange }: {
  lineNo: number;
  draft: Omit<SOLineItem, 'id' | 'lineNo'>;
  onChange: (key: keyof typeof draft, val: string) => void;
}) {
  return (
    <>
      <td className="px-2.5 py-1.5 text-stone-400 tabular-nums">{lineNo}</td>
      <td className="px-2 py-1.5"><input autoFocus type="text" value={draft.itemName} onChange={(e) => onChange('itemName', e.target.value)} placeholder="Item name" className={cn(inlineCls, 'min-w-[110px]')} aria-label="Item Name" /></td>
      <td className="px-2 py-1.5"><input type="text" value={draft.itemDescription} onChange={(e) => onChange('itemDescription', e.target.value)} placeholder="Description" className={cn(inlineCls, 'min-w-[120px]')} aria-label="Description" /></td>
      <td className="px-2 py-1.5"><input type="text" value={draft.itemSku} onChange={(e) => onChange('itemSku', e.target.value)} placeholder="SKU-0000" className={cn(inlineCls, 'w-24 font-mono')} aria-label="SKU" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" value={draft.quantity} onChange={(e) => onChange('quantity', e.target.value)} placeholder="0" className={cn(inlineCls, 'w-14 text-right')} aria-label="Quantity" /></td>
      <td className="px-2 py-1.5"><input type="text" value={draft.units} onChange={(e) => onChange('units', e.target.value)} placeholder="ea" className={cn(inlineCls, 'w-14')} aria-label="Units" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={draft.unitPrice} onChange={(e) => onChange('unitPrice', e.target.value)} placeholder="0.00" className={cn(inlineCls, 'w-20 text-right')} aria-label="Unit Price" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" max="100" value={draft.discount} onChange={(e) => onChange('discount', e.target.value)} placeholder="0" className={cn(inlineCls, 'w-14 text-right')} aria-label="Discount %" /></td>
      <td className="px-2 py-1.5"><input type="text" readOnly value={draft.amount ? `$${draft.amount}` : ''} className={cn(inlineCls, 'w-20 bg-stone-50 text-stone-500 cursor-default text-right')} aria-label="Amount" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" max="100" value={draft.tax} onChange={(e) => onChange('tax', e.target.value)} placeholder="0" className={cn(inlineCls, 'w-14 text-right')} aria-label="Tax %" /></td>
      <td className="px-2 py-1.5"><input type="text" readOnly value={draft.total ? `$${draft.total}` : ''} className={cn(inlineCls, 'w-20 bg-stone-50 text-stone-800 font-semibold cursor-default text-right')} aria-label="Total" /></td>
    </>
  );
}

// ── Inventory sub-tab ─────────────────────────────────────────────────────────

function InventorySubTab({ items }: { items: SOInventoryItem[] }) {
  if (!items.length) {
    return (
      <p className="py-8 text-center text-xs text-stone-400">
        Inventory data will be available after saving the order.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto modal-scrollbar rounded-lg border border-stone-200">
      <table className="w-full text-left text-xs">
        <thead className="bg-stone-50 border-b border-stone-200">
          <tr>
            {['Item Name', 'Item SKU', 'On Hand', 'Available', 'SO Qty', 'Allocated'].map((h) => (
              <th key={h} className="px-3 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100">
          {items.map((row) => (
            <tr key={row.id} className="hover:bg-stone-50/50">
              <td className="px-3 py-2.5 font-medium text-stone-800">{row.itemName}</td>
              <td className="px-3 py-2.5 font-mono text-2xs text-stone-500">{row.itemSku}</td>
              <td className="px-3 py-2.5 tabular-nums text-right text-stone-700">{row.onhandQty.toLocaleString()}</td>
              <td className="px-3 py-2.5 tabular-nums text-right">
                <span className={cn('font-medium', row.availableQty > 0 ? 'text-emerald-700' : 'text-red-600')}>
                  {row.availableQty.toLocaleString()}
                </span>
              </td>
              <td className="px-3 py-2.5 tabular-nums text-right text-stone-700">{row.salesOrderQty.toLocaleString()}</td>
              <td className="px-3 py-2.5 tabular-nums text-right text-amber-700 font-medium">{row.allocatedQty.toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── Drawings sub-tab ──────────────────────────────────────────────────────────

const DRAWING_TYPES: DrawingType[] = ['floor_plan', 'elevation', 'section', 'detail', 'fabrication', 'installation', 'shop_drawing', 'as_built', 'other'];
const DRAWING_STATUSES: DrawingStatus[] = ['draft', 'pending_review', 'approved', 'rejected'];

let drawingCounter = 0;
function genDrawingId() { drawingCounter += 1; return `drw-${drawingCounter}`; }

function DrawingsSubTab({ drawings, onUpdate }: { drawings: SODrawing[]; onUpdate: (v: SODrawing[]) => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [editId, setEditId]     = useState<string | null>(null);
  const [draft, setDraft]       = useState<Omit<SODrawing, 'id' | 'fileName' | 'fileSize' | 'uploadedBy' | 'uploadedAt'>>({
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AddSalesOrderPage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const panelRef    = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>('details');
  const [data, setData]           = useState<Record<string, unknown>>(soDefaults);
  const [lineItems, setLineItems] = useState<SOLineItem[]>([]);
  const [drawings, setDrawings]   = useState<SODrawing[]>([]);

  const set = useCallback((key: string, value: unknown) => setData((d) => ({ ...d, [key]: value })), []);

  const { subtotal, discountAmt, taxTotal, total } = useMemo(() => {
    const subtotal    = lineItems.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0);
    const discountAmt = lineItems.reduce((s, r) => {
      const base = (parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0);
      return s + base * ((parseFloat(r.discount) || 0) / 100);
    }, 0);
    const taxTotal = lineItems.reduce((s, r) => s + (parseFloat(r.total) || 0) - (parseFloat(r.amount) || 0), 0);
    return { subtotal, discountAmt, taxTotal, total: subtotal - discountAmt + taxTotal };
  }, [lineItems]);

  const inventoryItems: SOInventoryItem[] = [];

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () =>
      crmService.createRecord('sales_order', {
        coreFields: { ...data, line_items: lineItems, drawings, subtotal, discount_amt: discountAmt, tax_total: taxTotal, total },
        customFields: {},
      }),
    onSuccess: async (record) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'sales_order'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(record.id); } catch { /* non-fatal */ }
      }
      navigate('/sales/sales_order');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">

        <CrmPageHeader
          backLabel="Sales Orders"
          onBack={() => navigate('/sales/sales_order')}
          icon={ShoppingCart}
          title="New Sales Order"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Order'}
            </button>
          )}
        />

        {saveError && (
          <div className="shrink-0 flex items-start gap-3 border-b border-red-200 bg-red-50 px-5 py-2.5">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="size-3 text-red-600" />
            </span>
            <p className="text-xs text-red-700">
              <span className="font-bold">Error: </span>
              {apiErrorMessage(saveError, 'Failed to save sales order.')}
            </p>
          </div>
        )}

        {/* ── Page-level tab bar ── */}
        <div className="flex shrink-0 overflow-x-auto overflow-y-hidden border-b border-stone-200 bg-white px-5 3xl:px-10 4xl:px-16 modal-scrollbar">
          {PAGE_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'border-stone-800 text-stone-900'
                  : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300',
              )}
            >
              {tab.label}
              {tab.key === 'drawings' && drawings.length > 0 && (
                <span className="rounded-full bg-stone-100 px-1.5 py-0.5 text-2xs font-bold text-stone-500 tabular-nums">
                  {drawings.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto modal-scrollbar">
          <div className="px-4 py-3 pb-24 space-y-2 3xl:px-10 3xl:py-5 4xl:px-16 4xl:py-8">

            {activeTab === 'details' && (
              <>
                <ModernSection title="Primary Information" index={0}>
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
                    <div className="flex-1 min-w-0">
                      <SOSectionGrid fields={PRIMARY_INFO_FIELDS} data={data} set={set} maxCols={2} />
                    </div>
                    <div className="w-full lg:w-56 shrink-0">
                      <SOSummaryCard
                        subtotal={subtotal}
                        discountAmt={discountAmt}
                        taxTotal={taxTotal}
                        total={total}
                      />
                    </div>
                  </div>
                </ModernSection>
                <ModernSection title="Bill To" index={1}>
                  <SOSectionGrid fields={BILL_TO_FIELDS} data={data} set={set} />
                </ModernSection>
                <ModernSection title="Ship To" index={2}>
                  <SOSectionGrid fields={SHIP_TO_FIELDS} data={data} set={set} />
                </ModernSection>
                <ModernSection title="Sales Fields" index={3}>
                  <SOSectionGrid fields={SALES_INFO_FIELDS} data={data} set={set} />
                </ModernSection>
                <ModernSection title="Items" index={4}>
                  <ItemsSubTab items={lineItems} onUpdate={setLineItems} />
                </ModernSection>
              </>
            )}

            {activeTab === 'inventory' && (
              <InventorySubTab items={inventoryItems} />
            )}

            {activeTab === 'drawings' && (
              <DrawingsSubTab drawings={drawings} onUpdate={setDrawings} />
            )}

            {activeTab === 'audit' && (
              <p className="py-12 text-center text-sm text-stone-400">
                Audit trail will be available after saving the order.
              </p>
            )}

            {/* Always mounted so staged files survive tab switches */}
            <div className={activeTab === 'files' ? '' : 'hidden'}>
              <EditableFilesPanel ref={panelRef} />
            </div>
          </div>
        </div>

        <FormActionBar
          onCancel={() => navigate('/sales/sales_order')}
          isPending={isPending}
          submitLabel="Save Order"
        />
      </form>
    </div>
  );
}
