import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Copy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { expenseService } from '@/services/expenseService';
import { EMPTY_LINE_ITEM, categoryNameForCode, type ExpenseLineItem } from '@/lib/expenseForm';

const inlineCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300 transition-all';

let rowCounter = 0;
function genId() { rowCounter += 1; return `expli-${rowCounter}`; }

const ITEM_COLS = [
  { label: '#', w: 'w-8' },
  { label: 'Category *', w: 'min-w-[140px]' },
  { label: 'Date *', w: 'w-32' },
  { label: 'Description', w: 'min-w-[160px]' },
  { label: 'Amount *', w: 'w-24', right: true },
  { label: '', w: 'w-8' },
];

// Mirrors RequisitionLinesTable's inline add/edit UX, adapted to Expense's
// simpler line shape: category (select, from the lkp_expense_category
// lookup) + date + description + a directly-entered amount — no quantity,
// no unit price, no catalog item picker.
export function ExpenseLinesTable({ items, onUpdate }: {
  items: ExpenseLineItem[];
  onUpdate: (v: ExpenseLineItem[]) => void;
}) {
  const [draft, setDraft] = useState<Omit<ExpenseLineItem, 'id' | 'lineNo'>>(EMPTY_LINE_ITEM);
  const [editId, setEditId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const { data: categories = [] } = useQuery({
    queryKey: ['expense-categories'],
    queryFn: expenseService.getCategories,
    staleTime: 10 * 60 * 1000,
  });

  const updateDraft = (key: 'expenseDate' | 'amount' | 'description', val: string) => {
    setDraft((prev) => ({ ...prev, [key]: val }));
  };

  const onCategoryChange = (code: string) => {
    setDraft((prev) => ({ ...prev, categoryCode: code, categoryName: categoryNameForCode(categories, code) }));
  };

  const commitAdd = () => {
    if (!draft.categoryCode || !draft.expenseDate) return;
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

  const startEdit = (row: ExpenseLineItem) => {
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
                <th key={c.label} className={cn('px-2.5 py-2.5 text-2xs font-semibold uppercase tracking-wide text-stone-500 whitespace-nowrap', c.w, c.right && 'text-right')}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100">
            {items.map((row) =>
              editId === row.id ? (
                <tr key={row.id} className="bg-brand/5 divide-x divide-stone-100">
                  <InlineItemRow lineNo={row.lineNo} draft={draft} categories={categories} onChange={updateDraft} onCategoryChange={onCategoryChange} />
                  <td className="px-2 py-1.5">
                    <button type="button" onClick={() => remove(row.id)} className="text-stone-300 hover:text-destructive transition-colors" aria-label={`Remove line ${row.lineNo}`}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className="hover:bg-stone-50/70 transition-colors group divide-x divide-stone-100">
                  <td className="px-2.5 py-2.5 text-stone-400 tabular-nums">{row.lineNo}</td>
                  <td className="px-2.5 py-2.5 font-medium text-stone-800">{row.categoryName || row.categoryCode || <span className="text-stone-300">—</span>}</td>
                  <td className="px-2.5 py-2.5 text-stone-500">{row.expenseDate || '—'}</td>
                  <td className="px-2.5 py-2.5 text-stone-500 max-w-[180px] truncate">{row.description || '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-800 font-semibold">{row.amount ? `$${parseFloat(row.amount).toFixed(2)}` : '—'}</td>
                  <td className="px-2 py-2.5">
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100">
                      <button type="button" onClick={() => startEdit(row)} className="text-stone-300 hover:text-stone-600 transition-colors" aria-label={`Edit line ${row.lineNo}`}>
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => remove(row.id)} className="text-stone-300 hover:text-destructive transition-colors" aria-label={`Remove line ${row.lineNo}`}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {isAdding && (
              <tr className="bg-brand/5 divide-x divide-stone-100">
                <InlineItemRow lineNo={items.length + 1} draft={draft} categories={categories} onChange={updateDraft} onCategoryChange={onCategoryChange} />
                <td className="px-2 py-1.5" />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length === 0 && !isAdding && (
        <div className="flex flex-col items-center gap-1.5 py-8 text-center">
          <p className="text-xs text-stone-400">No expense lines yet.</p>
          <p className="text-2xs text-stone-300">Click <strong className="text-stone-500">+ Add Line</strong> to add a receipt.</p>
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
          {isAdding || editId ? 'Save Line' : 'Add Line'}
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

function InlineItemRow({ lineNo, draft, categories, onChange, onCategoryChange }: {
  lineNo: number;
  draft: Omit<ExpenseLineItem, 'id' | 'lineNo'>;
  categories: { id: number; code: string; name: string }[];
  onChange: (key: 'expenseDate' | 'amount' | 'description', val: string) => void;
  onCategoryChange: (code: string) => void;
}) {
  return (
    <>
      <td className="px-2.5 py-1.5 text-stone-400 tabular-nums">{lineNo}</td>
      <td className="px-2 py-1.5">
        <select
          value={draft.categoryCode}
          onChange={(e) => onCategoryChange(e.target.value)}
          className={cn(inlineCls, 'min-w-[130px]')}
          aria-label="Category"
        >
          <option value="">— Select —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.code}>{c.name}</option>
          ))}
        </select>
      </td>
      <td className="px-2 py-1.5">
        <input type="date" value={draft.expenseDate} onChange={(e) => onChange('expenseDate', e.target.value)} className={cn(inlineCls, 'w-28')} aria-label="Expense date" />
      </td>
      <td className="px-2 py-1.5">
        <input type="text" value={draft.description} onChange={(e) => onChange('description', e.target.value)} placeholder="Description" className={cn(inlineCls, 'min-w-[140px]')} aria-label="Description" />
      </td>
      <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={draft.amount} onChange={(e) => onChange('amount', e.target.value)} placeholder="0.00" className={cn(inlineCls, 'w-24 text-right')} aria-label="Amount" /></td>
    </>
  );
}
