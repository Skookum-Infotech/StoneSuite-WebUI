import { Plus, Pencil, Trash2, Copy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LINE_ACTIONS_HEAD_CLS, LINE_ACTIONS_CELL_CLS, LINE_ACTIONS_EDIT_CELL_CLS } from '@/lib/lineActionsColumn';
// Inventory catalog picker is tenant-wide, not sales-specific — reused as-is
// from its current home rather than duplicated (mirrors
// PurchaseOrderItemsTab's usage one folder over).
import { InventoryItemPicker, type InventoryItemPickerHandlers } from '@/pages/sales/components/InventoryItemPicker';
import { itemPrice } from '@/lib/itemPrice';
import type { InventoryItem } from '@/types/inventory';
import { useCatalogLineDraft } from '@/hooks/useCatalogLineDraft';
import { useAddKitLines } from '@/hooks/useAddKitLines';
import { useItemUnitCode } from '@/hooks/useItemUnitCode';
import { LineDimensionInputCells } from '@/components/inventory/LineDimensionInputCells';
import { LineDimensionViewCells } from '@/components/inventory/LineDimensionViewCells';
import {
  LINE_DIMENSION_COLS, clampDimensionField, itemDimensionUnit, normalizeUnit, isAreaUnit, isSized, withoutUnsupportedSize, withSizedQuantity,
} from '@/lib/lineDimensions';
import { blockEnterSubmit } from '@/lib/lineEntryKeys';
import { EMPTY_LINE_ITEM, calcLineItem, type RequisitionLineItem } from '@/lib/requisitionForm';

const inlineCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300 transition-all no-spinner';

let rowCounter = 0;
function genId() { rowCounter += 1; return `reqnli-${rowCounter}`; }

// `right: true` marks columns whose body cells render right-aligned
// (tabular-nums quantities/currency) — the header must match or the label
// reads misaligned against the numbers underneath it.
const ITEM_COLS = [
  { label: '#', w: 'w-8' },
  { label: 'Item Name *', w: 'min-w-[160px]' },
  { label: 'Description', w: 'min-w-[140px]' },
  { label: 'SKU', w: 'min-w-[90px]' },
  ...LINE_DIMENSION_COLS,
  { label: 'Units', w: 'w-16' },
  { label: 'Qty', w: 'w-20', right: true },
  { label: 'Est. Unit Price', w: 'w-24', right: true },
  { label: 'Amount', w: 'w-20', right: true },
  { label: '', w: LINE_ACTIONS_HEAD_CLS },
];

// Mirrors PurchaseOrderItemsTab, minus the discount and per-line tax columns
// — a requisition line is quantity × estimated unit price and nothing else
// (requisition/calc.go's ComputeLine). Tax is a single header-level percent
// applied to the subtotal, so unlike the PO grid there is no per-line tax
// preview column here. sku/units stay display-only (populated when a catalog
// item is picked); description is independently editable.
export function RequisitionLinesTable({ items, onUpdate }: {
  items: RequisitionLineItem[];
  onUpdate: (v: RequisitionLineItem[]) => void;
}) {
  // Length x width x slabs, when stated, IS the quantity — worked out here
  // before the amount is, so the two can never disagree.
  const recalc = (next: Omit<RequisitionLineItem, 'id' | 'lineNo'>) => {
    const sized = withSizedQuantity(next);
    return { ...sized, ...calcLineItem(sized) };
  };

  // Picking an inventory item snapshots its display fields into the draft;
  // the server re-snapshots authoritatively from inventoryItemUuid at save
  // time. The item's unit price seeds the *estimate* — the requester is
  // free to overwrite it, since a requisition predates any vendor quote.
  const unitCodeFor = useItemUnitCode();
  const applyCatalogItem = (prev: Omit<RequisitionLineItem, 'id' | 'lineNo'>, item: InventoryItem) => recalc(withoutUnsupportedSize({
    ...prev,
    itemName: item.name,
    units: unitCodeFor(item),
    itemDescription: item.description,
    itemSku: item.sku,
    estimatedUnitPrice: String(itemPrice(item, 'purchasing')),
    inventoryItemUuid: item.id,
    dimensionUnit: itemDimensionUnit(item),
  }));

  const {
    draft, setDraft, editId, setEditId, isAdding, setIsAdding, lineError, requireCatalogItem, addToInventory,
    addNewKit, returnedKit, reportLineError,
  } = useCatalogLineDraft(EMPTY_LINE_ITEM, applyCatalogItem);

  // Picking a kit adds its items as ordinary lines — Purchases tables show no
  // kit heading, so the lines carry no kit label.
  const { addKit, isAddingKit } = useAddKitLines({
    items,
    onUpdate,
    emptyDraft: EMPTY_LINE_ITEM,
    applyItem: applyCatalogItem,
    newId: genId,
    onAdded: () => { setDraft(EMPTY_LINE_ITEM); setIsAdding(false); },
    onError: reportLineError,
    returnedKit,
  });

  const updateDraft = (key: DraftKey, val: string) => {
    setDraft((prev) => recalc({ ...prev, [key]: clampDimensionField(key, val, draft.dimensionUnit) }));
  };

  // Typing the item name detaches the line from any previously picked
  // inventory item — a fresh pick is required before the line can be saved.
  // The description is left untouched — it's independent of the item name.
  const onItemNameText = (text: string) => {
    setDraft((prev) => recalc(withoutUnsupportedSize({ ...prev, itemName: text, inventoryItemUuid: undefined, itemSku: '', units: '' })));
  };

  const picker: InventoryItemPickerHandlers = {
    priceKind: 'purchasing',
    onTextChange: onItemNameText,
    onPick: (item) => setDraft((prev) => applyCatalogItem(prev, item)),
    onAddToInventory: addToInventory,
    // Kits only join a new line; an existing row being edited stays an item.
    onPickKit: editId ? undefined : (kit) => { void addKit(kit); },
    onAddKit: editId ? undefined : addNewKit,
  };

  const commitAdd = () => {
    if (!requireCatalogItem()) return;
    onUpdate([...items, { ...draft, id: genId(), lineNo: items.length + 1 }]);
    setDraft(EMPTY_LINE_ITEM);
    setIsAdding(false);
  };

  const commitEdit = () => {
    if (!editId || !requireCatalogItem()) return;
    onUpdate(items.map((r) => r.id === editId ? { ...draft, id: editId, lineNo: r.lineNo } : r));
    setEditId(null);
    setDraft(EMPTY_LINE_ITEM);
  };

  const startEdit = (row: RequisitionLineItem) => {
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
        <table className="w-full text-left text-xs" onKeyDown={blockEnterSubmit}>
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
                  <InlineItemRow lineNo={row.lineNo} draft={draft} onChange={updateDraft} picker={picker} />
                  <td className={LINE_ACTIONS_EDIT_CELL_CLS}>
                    <button type="button" onClick={() => remove(row.id)} className="text-stone-300 hover:text-destructive transition-colors" aria-label={`Remove line ${row.itemName || row.lineNo}`}>
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ) : (
                <tr key={row.id} className="hover:bg-stone-50/70 transition-colors group divide-x divide-stone-100">
                  <td className="px-2.5 py-2.5 text-stone-400 tabular-nums">{row.lineNo}</td>
                  <td className="px-2.5 py-2.5 font-medium text-stone-800">{row.itemName || <span className="text-stone-300">—</span>}</td>
                  <td className="px-2.5 py-2.5 text-stone-500 max-w-[140px] truncate">{row.itemDescription || '—'}</td>
                  <td className="px-2.5 py-2.5 text-stone-500 font-mono text-2xs">{row.itemSku || '—'}</td>
                  <LineDimensionViewCells length={row.length} width={row.width} slabs={row.slabs} unit={row.dimensionUnit} />
                  <td className="px-2.5 py-2.5 text-stone-500">{row.units || '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">{row.quantity}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">{row.estimatedUnitPrice ? `$${parseFloat(row.estimatedUnitPrice).toFixed(2)}` : '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-800 font-semibold">{row.amount ? `$${row.amount}` : '—'}</td>
                  <td className={LINE_ACTIONS_CELL_CLS}>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => startEdit(row)} className="text-stone-300 hover:text-stone-600 transition-colors" aria-label={`Edit line ${row.itemName || row.lineNo}`}>
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => remove(row.id)} className="text-stone-300 hover:text-destructive transition-colors" aria-label={`Remove line ${row.itemName || row.lineNo}`}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {isAdding && (
              <tr className="bg-brand/5 divide-x divide-stone-100">
                <InlineItemRow lineNo={items.length + 1} draft={draft} onChange={updateDraft} picker={picker} />
                <td className={LINE_ACTIONS_EDIT_CELL_CLS} />
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {items.length === 0 && !isAdding && (
        <div className="flex flex-col items-center gap-1.5 py-8 text-center">
          <p className="text-xs text-stone-400">No line items yet.</p>
          <p className="text-2xs text-stone-300">Click <strong className="text-stone-500">+ Add Line</strong> to request an item.</p>
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
        {isAddingKit && <p role="status" className="text-xs text-stone-500">Adding kit…</p>}
        {lineError && <p role="alert" className="text-xs font-medium text-destructive">{lineError}</p>}
      </div>
    </div>
  );
}

type DraftKey = 'quantity' | 'estimatedUnitPrice' | 'itemDescription' | 'length' | 'width' | 'slabs';

function InlineItemRow({ lineNo, draft, onChange, picker }: {
  lineNo: number;
  draft: Omit<RequisitionLineItem, 'id' | 'lineNo'>;
  onChange: (key: DraftKey, val: string) => void;
  picker: InventoryItemPickerHandlers;
}) {
  // Quantity is worked out from the dimensions while they are stated, so it is
  // shown but not editable.
  const sized = isSized(draft, draft.units);
  return (
    <>
      <td className="px-2.5 py-1.5 text-stone-400 tabular-nums">{lineNo}</td>
      <td className="px-2 py-1.5">
        <InventoryItemPicker {...picker} value={draft.itemName} className="min-w-[150px]" />
      </td>
      <td className="px-2 py-1.5">
        <input type="text" value={draft.itemDescription} onChange={(e) => onChange('itemDescription', e.target.value)} placeholder="Description" className={cn(inlineCls, 'min-w-[120px]')} aria-label="Description" />
      </td>
      <td className="px-2 py-1.5 text-stone-400 font-mono text-2xs">{draft.itemSku || '—'}</td>
      <LineDimensionInputCells
        dims={{ length: draft.length ?? '', width: draft.width ?? '', slabs: draft.slabs ?? '' }}
        unit={normalizeUnit(draft.dimensionUnit)}
        enabled={isAreaUnit(draft.units)}
        onChange={onChange}
      />
      <td className="px-2 py-1.5 text-stone-400 text-2xs">{draft.units || '—'}</td>
      <td className="px-2 py-1.5"><input type="number" min="0" step="any" value={draft.quantity} readOnly={sized} title={sized ? 'Worked out from length × width × slabs' : undefined} onChange={(e) => onChange('quantity', e.target.value)} placeholder="0" className={cn(inlineCls, 'w-16 text-right', sized && 'cursor-default bg-stone-50 text-stone-500')} aria-label="Quantity" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={draft.estimatedUnitPrice} onChange={(e) => onChange('estimatedUnitPrice', e.target.value)} placeholder="0.00" className={cn(inlineCls, 'w-24 text-right')} aria-label="Estimated Unit Price" /></td>
      <td className="px-2 py-1.5"><input type="text" readOnly value={draft.amount ? `$${draft.amount}` : ''} className={cn(inlineCls, 'w-20 bg-stone-50 text-stone-800 font-semibold cursor-default text-right')} aria-label="Amount" /></td>
    </>
  );
}
