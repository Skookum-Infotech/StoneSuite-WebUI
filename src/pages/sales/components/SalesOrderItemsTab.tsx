import { useState } from 'react';
import { Plus, Trash2, Copy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { InventoryItemPicker } from './InventoryItemPicker';
import type { InventoryItem } from '@/services/inventoryService';
import { Badge } from '@/components/tenant/ui';
import {
  EMPTY_LINE_ITEM, calcLineItem, clampPercent, FULFILLMENT_STATUS_LABELS, FULFILLMENT_STATUS_COLORS,
  type SOLineItem,
} from '@/lib/salesOrderForm';

const inlineCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300 transition-all';

let rowCounter = 0;
function genId() { rowCounter += 1; return `li-${rowCounter}`; }

// `right: true` marks columns whose body cells render right-aligned
// (tabular-nums quantities/currency) — the header must match or the
// label reads misaligned against the numbers underneath it.
const ITEM_COLS = [
  { label: '#', w: 'w-8' },
  { label: 'Item Name *', w: 'min-w-[130px]' },
  { label: 'Description', w: 'min-w-[140px]' },
  { label: 'SKU', w: 'min-w-[100px]' },
  { label: 'Qty', w: 'w-16', right: true },
  { label: 'Units', w: 'w-16' },
  { label: 'Unit Price', w: 'w-20', right: true },
  { label: 'Disc %', w: 'w-16', right: true },
  { label: 'Amount', w: 'w-20', right: true },
  { label: 'Tax %', w: 'w-16', right: true },
  { label: 'Total', w: 'w-20', right: true },
  { label: 'Fulfillment', w: 'w-24' },
  { label: '', w: 'w-8' },
];

export function SalesOrderItemsTab({ items, onUpdate }: { items: SOLineItem[]; onUpdate: (v: SOLineItem[]) => void }) {
  const [draft, setDraft] = useState<Omit<SOLineItem, 'id' | 'lineNo'>>(EMPTY_LINE_ITEM);
  const [editId, setEditId] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);

  const updateDraft = (key: keyof typeof draft, val: string) => {
    const nextVal = key === 'discount' || key === 'tax' ? clampPercent(val) : val;
    setDraft((prev) => {
      const next = { ...prev, [key]: nextVal };
      const { amount, total } = calcLineItem(next);
      return { ...next, amount, total };
    });
  };

  // Typing the item name manually detaches the line from any previously
  // picked catalog item — it becomes (or stays) a free-text line.
  const onItemNameText = (text: string) => {
    setDraft((prev) => {
      const next = { ...prev, itemName: text, inventoryItemUuid: undefined };
      const { amount, total } = calcLineItem(next);
      return { ...next, amount, total };
    });
  };

  // Picking a catalog suggestion snapshots its display fields into the draft;
  // the server re-snapshots authoritatively from inventoryItemUuid at save time.
  const pickCatalogItem = (item: InventoryItem) => {
    setDraft((prev) => {
      const next = {
        ...prev,
        itemName: item.name,
        itemSku: item.sku,
        itemDescription: item.description,
        unitPrice: String(item.unitPrice),
        inventoryItemUuid: item.id,
      };
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
                  <InlineItemRow lineNo={row.lineNo} draft={draft} onChange={updateDraft} onItemNameText={onItemNameText} onPickItem={pickCatalogItem} />
                  <td className="px-2 py-1.5">
                    <FulfillmentBadge status={row.status} />
                  </td>
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
                  <td className="px-2.5 py-2.5"><FulfillmentBadge status={row.status} /></td>
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
                <InlineItemRow lineNo={items.length + 1} draft={draft} onChange={updateDraft} onItemNameText={onItemNameText} onPickItem={pickCatalogItem} />
                <td className="px-2 py-1.5"><FulfillmentBadge status={draft.status} /></td>
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

// A freshly-added, unsaved line has no status yet — it's implicitly "open"
// (nothing can have been fulfilled before the order is even saved).
function FulfillmentBadge({ status = 'open' }: { status?: 'open' | 'partial' | 'filled' }) {
  return (
    <Badge color={FULFILLMENT_STATUS_COLORS[status]} size="sm">
      {FULFILLMENT_STATUS_LABELS[status]}
    </Badge>
  );
}

function InlineItemRow({ lineNo, draft, onChange, onItemNameText, onPickItem }: {
  lineNo: number;
  draft: Omit<SOLineItem, 'id' | 'lineNo'>;
  onChange: (key: keyof typeof draft, val: string) => void;
  onItemNameText: (text: string) => void;
  onPickItem: (item: InventoryItem) => void;
}) {
  return (
    <>
      <td className="px-2.5 py-1.5 text-stone-400 tabular-nums">{lineNo}</td>
      <td className="px-2 py-1.5">
        <InventoryItemPicker value={draft.itemName} onTextChange={onItemNameText} onPick={onPickItem} className="min-w-[130px]" />
      </td>
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
