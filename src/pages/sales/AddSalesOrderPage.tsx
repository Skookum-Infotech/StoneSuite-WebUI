import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ShoppingCart, AlertCircle, Loader2, Save, X,
  Plus, Copy, Trash2, ArrowUpDown, ChevronsUpDown,
} from 'lucide-react';
import { crmService } from '@/services/crmService';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import {
  PRIMARY_INFO_FIELDS,
  SALES_INFO_FIELDS,
  CLASSIFICATION_FIELDS,
  INTERCOMPANY_FIELDS,
  SO_TABS,
  salesOrderDefaults,
  type SOField,
  type SOSection,
  type SOTab,
  type SOLineItem,
} from '@/lib/salesOrderForm';

// ── Shared field class ────────────────────────────────────────────────────────

const fieldCls =
  'w-full rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs text-stone-800 outline-none placeholder:text-stone-300 focus:border-stone-400 focus:ring-2 focus:ring-stone-900/5 transition-all duration-150 disabled:bg-stone-50 disabled:text-stone-400 hover:border-stone-300';

const SECTION_ACCENTS: Record<string, string> = {
  'Primary Information':        'bg-purple-400',
  'Sales Information':          'bg-blue-400',
  'Classification':             'bg-amber-400',
  'Intercompany Management':    'bg-rose-400',
  'Shipping':                   'bg-sky-400',
  'Billing':                    'bg-teal-400',
  'Accounting':                 'bg-indigo-400',
  'Tax Details':                'bg-orange-400',
};

// ── UI primitives ─────────────────────────────────────────────────────────────

function SOSection({ title, children }: { title: string; children: React.ReactNode }) {
  const accent = SECTION_ACCENTS[title] ?? 'bg-stone-400';
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-3 border-b border-stone-100">
        <div className={cn('w-1 h-4 rounded-full shrink-0', accent)} />
        <h3 className="text-xs font-semibold text-stone-700">{title}</h3>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

function SOFieldShell({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="block text-2xs font-medium text-stone-500 leading-none">
        {label}
        {required && <span className="ml-0.5 text-red-400">*</span>}
      </label>
      {children}
    </div>
  );
}

function SOFieldInput({
  field,
  value,
  set,
}: {
  field: SOField;
  value: unknown;
  set: (key: string, val: unknown) => void;
}) {
  const str = typeof value === 'string' ? value : '';

  if (field.type === 'checkbox') {
    return (
      <label className="flex items-center gap-2.5 self-end pb-1 cursor-pointer group">
        <div
          className={cn(
            'h-4 w-4 rounded-md border-2 flex items-center justify-center shrink-0 transition-all duration-150',
            value === true
              ? 'bg-stone-800 border-stone-800'
              : 'border-stone-300 group-hover:border-stone-400 bg-white',
          )}
        >
          {value === true && (
            <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => set(field.key, e.target.checked)}
            className="sr-only"
            aria-label={field.label}
          />
        </div>
        <span className="text-xs text-stone-600 font-medium select-none">{field.label}</span>
      </label>
    );
  }

  return (
    <SOFieldShell label={field.label} required={field.required}>
      {field.type === 'textarea' ? (
        <textarea
          rows={3}
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={`${fieldCls} resize-none`}
          aria-label={field.label}
          placeholder={field.placeholder}
        />
      ) : field.type === 'select' ? (
        <select
          required={field.required}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={fieldCls}
          aria-label={field.label}
          disabled={field.readOnly}
        >
          {field.options?.map((opt) => (
            <option key={opt} value={opt}>
              {opt || '— Select —'}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={field.type ?? 'text'}
          required={field.required}
          readOnly={field.readOnly}
          placeholder={field.placeholder}
          value={str}
          onChange={(e) => set(field.key, e.target.value)}
          className={cn(fieldCls, field.readOnly && 'bg-stone-50 text-stone-400 cursor-default')}
          aria-label={field.label}
        />
      )}
    </SOFieldShell>
  );
}

function SOSectionFields({
  section,
  data,
  set,
}: {
  section: SOSection;
  data: Record<string, unknown>;
  set: (key: string, val: unknown) => void;
}) {
  return (
    <SOSection title={section.title}>
      <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5">
        {section.fields.map((f) => (
          <SOFieldInput key={f.key} field={f} value={data[f.key]} set={set} />
        ))}
      </div>
    </SOSection>
  );
}

function SOTabBar({
  tabs,
  active,
  onSelect,
}: {
  tabs: SOTab[];
  active: string;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="flex overflow-x-auto modal-scrollbar border-b border-stone-200 bg-white">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          onClick={() => onSelect(t.key)}
          aria-pressed={active === t.key}
          className={cn(
            'px-4 py-2.5 text-xs font-medium whitespace-nowrap border-b-2 -mb-px transition-all duration-150',
            active === t.key
              ? 'border-stone-800 text-stone-800'
              : 'border-transparent text-stone-400 hover:text-stone-600 hover:border-stone-300',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ── Order summary card ────────────────────────────────────────────────────────

function OrderSummaryCard({ subtotal, discount, taxRate }: { subtotal: number; discount: number; taxRate: number }) {
  const taxTotal = (subtotal - discount) * (taxRate / 100);
  const total    = subtotal - discount + taxTotal;
  const fmt      = (n: number) => n.toFixed(2);
  return (
    <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden w-56 shrink-0 self-start">
      <div className="px-4 py-2.5 bg-teal-600">
        <p className="text-xs font-semibold text-white">Summary</p>
      </div>
      <div className="divide-y divide-stone-100">
        {[
          { label: 'SUBTOTAL',      value: fmt(subtotal) },
          { label: 'DISCOUNT ITEM', value: fmt(discount) },
          { label: 'TAX TOTAL',     value: fmt(taxTotal) },
        ].map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between px-4 py-2">
            <span className="text-2xs text-stone-500 font-medium">{label}</span>
            <span className="text-xs text-stone-700 font-medium tabular-nums">{value}</span>
          </div>
        ))}
        <div className="flex items-center justify-between px-4 py-2.5 bg-stone-50">
          <span className="text-xs font-bold text-stone-800">TOTAL</span>
          <span className="text-xs font-bold text-stone-900 tabular-nums">{fmt(total)}</span>
        </div>
      </div>
    </div>
  );
}

// ── Items table ───────────────────────────────────────────────────────────────

const EMPTY_ROW: Omit<SOLineItem, 'id'> = {
  item: '',
  quantity: '',
  units: '',
  description: '',
  priceLevel: '',
  rate: '',
  amount: '',
  commit: false,
  commitmentConfirmed: false,
  orderPriority: '',
  grossAmt: '',
};

const inlineCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300';

let rowCounter = 0;
function genId() {
  rowCounter += 1;
  return `row-${rowCounter}`;
}

function ItemsTable({
  lineItems,
  onUpdate,
}: {
  lineItems: SOLineItem[];
  onUpdate: (items: SOLineItem[]) => void;
}) {
  const [draft, setDraft]       = useState<Omit<SOLineItem, 'id'>>(EMPTY_ROW);
  const [editId, setEditId]     = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [discountItem, setDiscountItem] = useState('');
  const [discountRate, setDiscountRate] = useState('');

  function calcAmount(qty: string, rate: string) {
    const q = parseFloat(qty);
    const r = parseFloat(rate);
    if (!isNaN(q) && !isNaN(r)) return (q * r).toFixed(2);
    return '';
  }

  function handleDraftChange(key: keyof Omit<SOLineItem, 'id'>, val: string | boolean) {
    setDraft((prev) => {
      const next = { ...prev, [key]: val };
      if (key === 'quantity' || key === 'rate') {
        next.amount    = calcAmount(key === 'quantity' ? (val as string) : prev.quantity, key === 'rate' ? (val as string) : prev.rate);
        next.grossAmt  = next.amount;
      }
      return next;
    });
  }

  function commitAdd() {
    if (!draft.item) return;
    onUpdate([...lineItems, { ...draft, id: genId() }]);
    setDraft(EMPTY_ROW);
    setIsAdding(false);
  }

  function cancelAdd() {
    setDraft(EMPTY_ROW);
    setIsAdding(false);
  }

  function removeRow(id: string) {
    onUpdate(lineItems.filter((r) => r.id !== id));
  }

  function startEdit(row: SOLineItem) {
    setEditId(row.id);
    setDraft({ ...row });
    setIsAdding(false);
  }

  function commitEdit() {
    if (!editId) return;
    onUpdate(lineItems.map((r) => (r.id === editId ? { ...draft, id: editId } : r)));
    setEditId(null);
    setDraft(EMPTY_ROW);
  }

  function cancelEdit() {
    setEditId(null);
    setDraft(EMPTY_ROW);
  }

  function copyPrevious() {
    if (lineItems.length === 0) return;
    const last = lineItems[lineItems.length - 1];
    setDraft({ ...last });
    setIsAdding(true);
  }

  function clearAll() {
    onUpdate([]);
  }

  const COL_WIDTHS = [
    'min-w-[140px]', // Item
    'min-w-[72px]',  // Quantity
    'min-w-[64px]',  // Units
    'min-w-[140px]', // Description
    'min-w-[96px]',  // Price Level
    'min-w-[72px]',  // Rate
    'min-w-[80px]',  // Amount
    'min-w-[60px]',  // Commit
    'min-w-[80px]',  // Commitment Confirmed
    'min-w-[96px]',  // Order Priority
    'min-w-[80px]',  // Gross Amt
  ];

  const activeDraft = isAdding || editId !== null;

  return (
    <div className="space-y-3">
      {/* Controls bar */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex gap-3">
          <SOFieldShell label="Discount Item">
            <select
              value={discountItem}
              onChange={(e) => setDiscountItem(e.target.value)}
              className={cn(fieldCls, 'w-40')}
              aria-label="Discount Item"
            >
              <option value="">— Select —</option>
              <option value="discount_5">5% Discount</option>
              <option value="discount_10">10% Discount</option>
              <option value="discount_15">15% Discount</option>
              <option value="discount_20">20% Discount</option>
            </select>
          </SOFieldShell>
          <SOFieldShell label="Rate">
            <input
              type="number"
              value={discountRate}
              onChange={(e) => setDiscountRate(e.target.value)}
              className={cn(fieldCls, 'w-28')}
              placeholder="0.00"
              aria-label="Discount Rate"
            />
          </SOFieldShell>
        </div>
        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={() => { setIsAdding(true); setEditId(null); setDraft(EMPTY_ROW); }}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            Add Multiple
          </button>
          <button
            type="button"
            onClick={clearAll}
            className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-50 transition-colors"
          >
            Clear All Lines
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-stone-200 bg-white overflow-hidden shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-2xs uppercase tracking-wide text-stone-500 border-b border-stone-200">
              <tr>
                {[
                  'Item *', 'Quantity', 'Units', 'Description',
                  'Price Level', 'Rate', 'Amount', 'Commit',
                  'Commitment Confirmed', 'Order Priority', 'Gross Amt',
                ].map((col, i) => (
                  <th key={col} className={cn('px-3 py-2.5 font-semibold whitespace-nowrap', COL_WIDTHS[i])}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {lineItems.map((row) => {
                if (editId === row.id) {
                  return (
                    <tr key={row.id} className="bg-brand/5">
                      <InlineRow draft={draft} onChange={handleDraftChange} />
                    </tr>
                  );
                }
                return (
                  <tr
                    key={row.id}
                    className="hover:bg-stone-50/70 transition-colors cursor-pointer"
                    onClick={() => startEdit(row)}
                  >
                    <td className="px-3 py-2 font-medium text-stone-800">{row.item || <span className="text-stone-300">—</span>}</td>
                    <td className="px-3 py-2 text-stone-600 text-right tabular-nums">{row.quantity}</td>
                    <td className="px-3 py-2 text-stone-600">{row.units}</td>
                    <td className="px-3 py-2 text-stone-600">{row.description}</td>
                    <td className="px-3 py-2 text-stone-600">{row.priceLevel}</td>
                    <td className="px-3 py-2 text-stone-600 text-right tabular-nums">{row.rate}</td>
                    <td className="px-3 py-2 text-stone-700 font-medium text-right tabular-nums">{row.amount}</td>
                    <td className="px-3 py-2 text-center">
                      {row.commit && (
                        <svg className="h-3.5 w-3.5 text-teal-600 mx-auto" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {row.commitmentConfirmed && (
                        <svg className="h-3.5 w-3.5 text-teal-600 mx-auto" viewBox="0 0 12 12" fill="none">
                          <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </td>
                    <td className="px-3 py-2 text-stone-600">{row.orderPriority}</td>
                    <td className="px-3 py-2 text-stone-700 font-medium text-right tabular-nums">{row.grossAmt}</td>
                  </tr>
                );
              })}

              {/* New row editor */}
              {isAdding && (
                <tr className="bg-brand/5">
                  <InlineRow draft={draft} onChange={handleDraftChange} />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {lineItems.length === 0 && !isAdding && (
          <div className="flex h-20 items-center justify-center text-xs text-stone-400">
            No line items. Click <strong className="mx-1 font-semibold text-stone-600">+ Add</strong> to add a line.
          </div>
        )}

        {/* Row action bar */}
        <div className="flex flex-wrap items-center gap-2 px-4 py-3 border-t border-stone-100 bg-stone-50/50">
          <button
            type="button"
            onClick={() => {
              if (isAdding)       commitAdd();
              else if (editId)    commitEdit();
              else { setIsAdding(true); setEditId(null); setDraft(EMPTY_ROW); }
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-stone-900 hover:bg-brand/80 transition-colors"
          >
            <Plus className="size-3" />
            {isAdding || editId ? 'Save Line' : 'Add'}
          </button>
          <button
            type="button"
            onClick={isAdding ? cancelAdd : editId ? cancelEdit : undefined}
            disabled={!activeDraft}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 transition-colors"
          >
            <X className="size-3" />
            Cancel
          </button>
          <button
            type="button"
            onClick={copyPrevious}
            disabled={lineItems.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 transition-colors"
          >
            <Copy className="size-3" />
            Copy Previous
          </button>
          <button
            type="button"
            onClick={() => { if (!activeDraft) { setIsAdding(true); setEditId(null); setDraft(EMPTY_ROW); } }}
            disabled={activeDraft}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 transition-colors"
          >
            <Plus className="size-3" />
            Insert
          </button>
          <button
            type="button"
            onClick={() => { if (lineItems.length) removeRow(lineItems[lineItems.length - 1].id); }}
            disabled={lineItems.length === 0}
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 transition-colors"
          >
            <Trash2 className="size-3" />
            Remove
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-md border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors"
          >
            <ArrowUpDown className="size-3" />
            Alternative Items
          </button>
        </div>
      </div>
    </div>
  );
}

function InlineRow({
  draft,
  onChange,
}: {
  draft: Omit<SOLineItem, 'id'>;
  onChange: (key: keyof Omit<SOLineItem, 'id'>, val: string | boolean) => void;
}) {
  return (
    <>
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1">
          <input
            autoFocus
            type="text"
            value={draft.item}
            onChange={(e) => onChange('item', e.target.value)}
            placeholder="<Type then tab>"
            className={cn(inlineCls, 'min-w-[120px]')}
            aria-label="Item"
          />
          <ChevronsUpDown className="size-3 text-stone-400 shrink-0" />
        </div>
      </td>
      <td className="px-2 py-1.5">
        <input
          type="number"
          value={draft.quantity}
          onChange={(e) => onChange('quantity', e.target.value)}
          placeholder="0"
          className={cn(inlineCls, 'w-16 text-right')}
          aria-label="Quantity"
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          type="text"
          value={draft.units}
          onChange={(e) => onChange('units', e.target.value)}
          placeholder="ea"
          className={cn(inlineCls, 'w-14')}
          aria-label="Units"
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          type="text"
          value={draft.description}
          onChange={(e) => onChange('description', e.target.value)}
          placeholder="Description"
          className={cn(inlineCls, 'min-w-[120px]')}
          aria-label="Description"
        />
      </td>
      <td className="px-2 py-1.5">
        <select
          value={draft.priceLevel}
          onChange={(e) => onChange('priceLevel', e.target.value)}
          className={cn(inlineCls, 'w-24')}
          aria-label="Price Level"
        >
          <option value="">— Select —</option>
          <option value="base_price">Base Price</option>
          <option value="online_price">Online Price</option>
          <option value="partner_price">Partner Price</option>
        </select>
      </td>
      <td className="px-2 py-1.5">
        <input
          type="number"
          value={draft.rate}
          onChange={(e) => onChange('rate', e.target.value)}
          placeholder="0.00"
          className={cn(inlineCls, 'w-16 text-right')}
          aria-label="Rate"
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          type="text"
          value={draft.amount}
          readOnly
          className={cn(inlineCls, 'w-18 bg-stone-50 text-stone-500 cursor-default text-right')}
          aria-label="Amount"
        />
      </td>
      <td className="px-2 py-1.5 text-center">
        <label className="cursor-pointer">
          <input
            type="checkbox"
            checked={draft.commit}
            onChange={(e) => onChange('commit', e.target.checked)}
            className="h-3.5 w-3.5 accent-teal-600"
            aria-label="Commit"
          />
        </label>
      </td>
      <td className="px-2 py-1.5 text-center">
        <label className="cursor-pointer">
          <input
            type="checkbox"
            checked={draft.commitmentConfirmed}
            onChange={(e) => onChange('commitmentConfirmed', e.target.checked)}
            className="h-3.5 w-3.5 accent-teal-600"
            aria-label="Commitment Confirmed"
          />
        </label>
      </td>
      <td className="px-2 py-1.5">
        <input
          type="text"
          value={draft.orderPriority}
          onChange={(e) => onChange('orderPriority', e.target.value)}
          placeholder="—"
          className={cn(inlineCls, 'w-20')}
          aria-label="Order Priority"
        />
      </td>
      <td className="px-2 py-1.5">
        <input
          type="text"
          value={draft.grossAmt}
          readOnly
          className={cn(inlineCls, 'w-18 bg-stone-50 text-stone-500 cursor-default text-right')}
          aria-label="Gross Amount"
        />
      </td>
    </>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AddSalesOrderPage() {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();
  const [data, setData]   = useState<Record<string, unknown>>(salesOrderDefaults);
  const [activeTab, setActiveTab] = useState(SO_TABS[0]?.key ?? 'items');
  const [lineItems, setLineItems] = useState<SOLineItem[]>([]);

  const set = (key: string, value: unknown) => setData((d) => ({ ...d, [key]: value }));

  const { mutate: createOrder, isPending, error: createError } = useMutation({
    mutationFn: () =>
      crmService.createRecord('sales_order', {
        coreFields: { ...data, line_items: lineItems },
        customFields: {},
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['crm-records', 'sales_order'] });
      navigate('/sales/sales_order');
    },
  });

  // Derive totals from line items
  const subtotal = useMemo(
    () => lineItems.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0),
    [lineItems],
  );
  const taxRate = parseFloat(String(data.tax_rate ?? '0')) || 0;

  const activeTabObj = SO_TABS.find((t) => t.key === activeTab) ?? SO_TABS[0];

  const customer = String(data.customer_project ?? '');
  const orderNum = String(data.order_number ?? '');

  return (
    <div className="flex flex-1 min-h-0 bg-stone-50">
      <form
        onSubmit={(e) => { e.preventDefault(); createOrder(); }}
        className="flex flex-1 min-h-0 min-w-0"
      >
        {/* ── Left: scrollable form body ── */}
        <div className="flex flex-col flex-1 min-h-0 min-w-0">

          {/* Page title */}
          <div className="shrink-0 bg-white border-b border-stone-100 px-6 py-3.5 flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
              <ShoppingCart className="h-4 w-4 text-teal-600" />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-stone-800 leading-tight">New Sales Order</h1>
              <p className="text-2xs text-stone-400 mt-0.5">Fill in the details to create a sales order</p>
            </div>
          </div>

          {/* Scrollable form */}
          <div className="flex-1 overflow-y-auto modal-scrollbar px-6 py-5 space-y-4">

            {/* Primary Information — with inline summary card */}
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
              <div className="flex items-center gap-2.5 px-5 py-3 border-b border-stone-100">
                <div className="w-1 h-4 rounded-full shrink-0 bg-purple-400" />
                <h3 className="text-xs font-semibold text-stone-700">Primary Information</h3>
              </div>
              <div className="px-5 py-4 flex gap-5 items-start">
                <div className="flex-1 grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-2">
                  {PRIMARY_INFO_FIELDS.map((f) => (
                    <div key={f.key} className={f.type === 'textarea' ? 'sm:col-span-2' : ''}>
                      <SOFieldInput field={f} value={data[f.key]} set={set} />
                    </div>
                  ))}
                </div>
                <OrderSummaryCard subtotal={subtotal} discount={0} taxRate={taxRate} />
              </div>
            </div>

            {/* Sales Information */}
            <SOSectionFields
              section={{ title: 'Sales Information', fields: SALES_INFO_FIELDS }}
              data={data}
              set={set}
            />

            {/* Classification */}
            <SOSectionFields
              section={{ title: 'Classification', fields: CLASSIFICATION_FIELDS }}
              data={data}
              set={set}
            />

            {/* Intercompany Management */}
            <SOSectionFields
              section={{ title: 'Intercompany Management', fields: INTERCOMPANY_FIELDS }}
              data={data}
              set={set}
            />

            {/* Tabbed section */}
            <div className="rounded-xl border border-stone-200 bg-white shadow-sm overflow-hidden">
              <SOTabBar tabs={SO_TABS} active={activeTabObj.key} onSelect={setActiveTab} />
              <div className="px-5 py-4">
                {activeTabObj.key === 'items' ? (
                  <ItemsTable lineItems={lineItems} onUpdate={setLineItems} />
                ) : activeTabObj.sections.length > 0 ? (
                  <div className="space-y-4">
                    {activeTabObj.sections.map((section) => (
                      <div key={section.title}>
                        <div className="grid grid-cols-1 gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 4xl:grid-cols-5">
                          {section.fields.map((f) => (
                            <SOFieldInput key={f.key} field={f} value={data[f.key]} set={set} />
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 py-6">
                    <div className="h-1.5 w-1.5 rounded-full bg-stone-300" />
                    <p className="text-xs text-stone-400">
                      {activeTabObj.label} details will be available after saving
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div className="h-4" />
          </div>
        </div>

        {/* ── Right: sticky actions panel ── */}
        <div className="w-60 xl:w-64 shrink-0 border-l border-stone-200 bg-white flex flex-col overflow-y-auto modal-scrollbar">

          {/* Save / Cancel */}
          <div className="p-4 border-b border-stone-100 space-y-2">
            <button
              type="submit"
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-xs font-semibold text-stone-900 hover:bg-brand-hover disabled:opacity-50 transition-all duration-150 shadow-sm hover:shadow"
            >
              {isPending ? (
                <><Loader2 className="size-3.5 animate-spin" />Saving…</>
              ) : (
                <><Save className="size-3.5" />Save Order</>
              )}
            </button>
            <button
              type="button"
              onClick={() => navigate('/sales/sales_order')}
              disabled={isPending}
              className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-4 py-2 text-xs font-medium text-stone-600 hover:bg-stone-50 hover:border-stone-300 disabled:opacity-50 transition-all duration-150"
            >
              <X className="size-3.5" />
              Cancel
            </button>

            {createError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs text-red-700">
                <AlertCircle className="size-3.5 shrink-0 mt-0.5" />
                <span>{apiErrorMessage(createError, 'Failed to save order.')}</span>
              </div>
            )}
          </div>

          {/* Order preview */}
          <div className="p-4 border-b border-stone-100">
            <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5">Preview</p>
            <div className="rounded-lg bg-stone-50 border border-stone-100 p-3 space-y-2.5">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                  <ShoppingCart className="h-3.5 w-3.5 text-teal-600" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-stone-800 truncate leading-tight">
                    {customer || <span className="text-stone-400 font-normal italic">No customer</span>}
                  </p>
                  <p className="text-2xs text-stone-400 mt-0.5">
                    {orderNum || 'New Order'}
                  </p>
                </div>
              </div>
              {(Boolean(data.date) || Boolean(data.status)) && (
                <div className="pt-2 space-y-1 border-t border-stone-200">
                  {Boolean(data.date) && (
                    <p className="text-2xs text-stone-500 truncate">Date: {String(data.date)}</p>
                  )}
                  {Boolean(data.status) && (
                    <p className="text-2xs text-stone-500 truncate">{String(data.status)}</p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Order totals */}
          <div className="p-4 border-b border-stone-100">
            <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5">Order Totals</p>
            <div className="space-y-1.5">
              {[
                { label: 'Items', value: lineItems.length },
                { label: 'Subtotal', value: `${subtotal.toFixed(2)}` },
                { label: 'Tax Rate', value: `${taxRate}%` },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-center justify-between gap-2">
                  <span className="text-2xs text-stone-400 shrink-0">{label}</span>
                  <span className="text-2xs font-medium text-stone-600 truncate text-right tabular-nums">
                    {value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Assignment */}
          <div className="p-4 border-b border-stone-100">
            <p className="text-2xs font-semibold uppercase tracking-wider text-stone-400 mb-2.5">Assignment</p>
            <div className="space-y-2">
              {[
                { label: 'Sales Rep', key: 'sales_rep' },
                { label: 'Partner',   key: 'partner' },
                { label: 'Subsidiary', key: 'subsidiary' },
              ].map(({ label, key }) => (
                <div key={key} className="flex items-center justify-between gap-2">
                  <span className="text-2xs text-stone-400 shrink-0">{label}</span>
                  <span className="text-2xs font-medium text-stone-600 truncate text-right">
                    {data[key] ? String(data[key]) : <span className="text-stone-300 font-normal">—</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Tip */}
          <div className="p-4 mt-auto">
            <div className="rounded-lg bg-amber-50 border border-amber-100 p-3">
              <p className="text-2xs font-semibold text-amber-700 mb-1">Tip</p>
              <p className="text-2xs text-amber-600 leading-relaxed">
                Use the <strong>Items</strong> tab to add line items. Amount is calculated automatically from Quantity × Rate.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
