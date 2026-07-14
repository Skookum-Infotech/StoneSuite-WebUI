import { useState, useMemo, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Receipt, AlertCircle, Loader2, Save, Plus, Trash2, Copy, X,
} from 'lucide-react';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import { ModernSection, ModernFieldShell, FormActionBar } from '@/components/crm/FormPrimitives';
import {
  fieldCls, textareaCls, readonlyCls, checkboxLabelCls,
} from '@/components/crm/formUtils';
import { CrmPageHeader } from '@/pages/crm/components/CrmPageHeader';
import { EditableFilesPanel, type EditableFilesPanelHandle } from '@/components/crm/CrmSubTabsPanel';
import {
  PRIMARY_INFO_FIELDS, BILL_TO_FIELDS, SHIP_TO_FIELDS, SALES_INFO_FIELDS,
  invoiceDefaults,
  type InvoiceFormField,
  type InvoiceLineItem,
  EMPTY_LINE_ITEM, calcLineItem,
} from '@/lib/invoiceForm';

// ── Page-level tabs ───────────────────────────────────────────────────────────

const PAGE_TABS = [
  { key: 'details', label: 'Details' },
  { key: 'audit',   label: 'Audit' },
  { key: 'files',   label: 'Files' },
] as const;
type PageTab = (typeof PAGE_TABS)[number]['key'];

// ── Field renderer ────────────────────────────────────────────────────────────

function InvoiceField({ field, value, set }: {
  field: InvoiceFormField;
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

function InvoiceSectionGrid({ fields, data, set, maxCols = 3 }: {
  fields: InvoiceFormField[];
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
        <InvoiceField key={f.key} field={f} value={data[f.key]} set={set} />
      ))}
    </div>
  );
}

// ── Summary card ─────────────────────────────────────────────────────────────

function InvoiceSummaryCard({ subtotal, discountAmt, taxTotal, total, amountPaid, setAmountPaid }: {
  subtotal: number; discountAmt: number; taxTotal: number; total: number;
  amountPaid: string; setAmountPaid: (v: string) => void;
}) {
  const fmt = (n: number) =>
    '$' + n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const amountDue = total - (parseFloat(amountPaid) || 0);

  const rows = [
    { label: 'Sub Total', value: fmt(subtotal) },
    { label: 'Discount',  value: fmt(discountAmt) },
    { label: 'Tax Total', value: fmt(taxTotal) },
  ];

  return (
    <div className="rounded-lg border border-stone-200 bg-white overflow-hidden sticky top-4">
      <div className="px-4 py-2.5 bg-stone-50 border-b border-stone-200">
        <p className="text-2xs font-semibold uppercase tracking-wide text-stone-500">Summary</p>
      </div>
      <div className="divide-y divide-stone-100">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-2.5">
            <span className="text-xs text-stone-500">{label}</span>
            <span className="tabular-nums text-xs font-semibold text-stone-600">{value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-t border-stone-200">
          <span className="text-xs text-stone-700 font-medium">Total</span>
          <span className="tabular-nums text-sm font-bold text-stone-900">{fmt(total)}</span>
        </div>
        <div className="flex items-center justify-between gap-2 px-4 py-2.5">
          <label htmlFor="amount_paid" className="text-xs text-stone-500 shrink-0">Amount Paid</label>
          <input
            id="amount_paid"
            type="number"
            min="0"
            step="0.01"
            value={amountPaid}
            onChange={(e) => setAmountPaid(e.target.value)}
            aria-label="Amount Paid"
            className="w-24 rounded border border-stone-200 bg-white px-2 py-1 text-right text-xs tabular-nums text-stone-700 outline-none focus:border-brand focus:ring-1 focus:ring-brand/30"
          />
        </div>
        <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50 border-t border-stone-200">
          <span className="text-xs text-stone-700 font-medium">Amount Due</span>
          <span className="tabular-nums text-sm font-bold text-stone-900">{fmt(amountDue)}</span>
        </div>
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

function ItemsSubTab({ items, onUpdate }: { items: InvoiceLineItem[]; onUpdate: (v: InvoiceLineItem[]) => void }) {
  const [draft, setDraft]   = useState<Omit<InvoiceLineItem, 'id' | 'lineNo'>>(EMPTY_LINE_ITEM);
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

  const startEdit = (row: InvoiceLineItem) => {
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
            <tr className="divide-x divide-stone-200">
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
                <tr key={row.id} className="bg-brand/5 divide-x divide-stone-100">
                  <InlineItemRow lineNo={row.lineNo} draft={draft} onChange={updateDraft} />
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={() => remove(row.id)} className="text-stone-300 hover:text-destructive transition-colors" aria-label="Remove">
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className="hover:bg-stone-50/70 transition-colors cursor-pointer group divide-x divide-stone-100" onClick={() => startEdit(row)}>
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
              <tr className="bg-brand/5 divide-x divide-stone-100">
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
  draft: Omit<InvoiceLineItem, 'id' | 'lineNo'>;
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

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AddInvoicePage() {
  const navigate    = useNavigate();
  const queryClient = useQueryClient();
  const panelRef    = useRef<EditableFilesPanelHandle>(null);

  const [activeTab, setActiveTab] = useState<PageTab>('details');
  const [data, setData]           = useState<Record<string, unknown>>(invoiceDefaults);
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([]);

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

  const amountPaid = typeof data.amount_paid === 'string' ? data.amount_paid : '0';
  const amountDue  = total - (parseFloat(amountPaid) || 0);

  const { mutate: save, isPending, error: saveError } = useMutation({
    mutationFn: () =>
      crmService.createRecord('invoice', {
        coreFields: {
          ...data,
          line_items: lineItems,
          subtotal,
          discount_amt: discountAmt,
          tax_total: taxTotal,
          total,
          amount_due: amountDue,
        },
        customFields: {},
      }),
    onSuccess: async (record) => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'invoice'] });
      if (panelRef.current?.hasStagedFiles()) {
        try { await panelRef.current.uploadStagedTo(record.id); } catch { /* non-fatal */ }
      }
      navigate('/sales/invoice');
    },
  });

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-stone-50">
      <form onSubmit={(e) => { e.preventDefault(); save(); }} className="flex flex-col flex-1 min-h-0">

        <CrmPageHeader
          backLabel="Invoices"
          onBack={() => navigate('/sales/invoice')}
          icon={Receipt}
          title="New Invoice"
          subtitle="Fields marked * are required."
          actions={(
            <button type="submit" disabled={isPending}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all shadow-sm">
              {isPending ? <Loader2 className="size-3 animate-spin" /> : <Save className="size-3" />}
              {isPending ? 'Saving…' : 'Save Invoice'}
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
              {apiErrorMessage(saveError, 'Failed to save invoice.')}
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
                      <InvoiceSectionGrid fields={PRIMARY_INFO_FIELDS} data={data} set={set} maxCols={2} />
                    </div>
                    <div className="w-full lg:w-56 shrink-0">
                      <InvoiceSummaryCard
                        subtotal={subtotal}
                        discountAmt={discountAmt}
                        taxTotal={taxTotal}
                        total={total}
                        amountPaid={amountPaid}
                        setAmountPaid={(v) => set('amount_paid', v)}
                      />
                    </div>
                  </div>
                </ModernSection>
                <ModernSection title="Bill To" index={1}>
                  <InvoiceSectionGrid fields={BILL_TO_FIELDS} data={data} set={set} />
                </ModernSection>
                <ModernSection title="Ship To" index={2}>
                  <InvoiceSectionGrid fields={SHIP_TO_FIELDS} data={data} set={set} />
                </ModernSection>
                <ModernSection title="Sales Fields" index={3}>
                  <InvoiceSectionGrid fields={SALES_INFO_FIELDS} data={data} set={set} />
                </ModernSection>
                <ModernSection title="Items" index={4}>
                  <ItemsSubTab items={lineItems} onUpdate={setLineItems} />
                </ModernSection>
              </>
            )}

            {activeTab === 'audit' && (
              <p className="py-12 text-center text-sm text-stone-400">
                Audit trail will be available after saving the invoice.
              </p>
            )}

            {/* Always mounted so staged files survive tab switches */}
            <div className={activeTab === 'files' ? '' : 'hidden'}>
              <EditableFilesPanel ref={panelRef} />
            </div>
          </div>
        </div>

        <FormActionBar
          onCancel={() => navigate('/sales/invoice')}
          isPending={isPending}
          submitLabel="Save Invoice"
        />
      </form>
    </div>
  );
}
