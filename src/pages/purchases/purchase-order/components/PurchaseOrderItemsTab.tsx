import { Fragment } from 'react';
import { Plus, Pencil, Trash2, Copy, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LINE_ACTIONS_HEAD_CLS, LINE_ACTIONS_CELL_CLS, LINE_ACTIONS_EDIT_CELL_CLS } from '@/lib/lineActionsColumn';
// Inventory catalog picker is tenant-wide, not sales-specific — reused as-is
// from its current home rather than duplicated (mirrors EstimateItemsTab's
// usage one folder over).
import { InventoryItemPicker, type InventoryItemPickerHandlers } from '@/pages/sales/components/InventoryItemPicker';
import { itemPrice } from '@/lib/itemPrice';
import { TRACKING_SERIALIZED, type InventoryItem } from '@/types/inventory';
import { useCatalogLineDraft } from '@/hooks/useCatalogLineDraft';
import { useAddKitLines } from '@/hooks/useAddKitLines';
import { useItemUnitCode } from '@/hooks/useItemUnitCode';
import { unitLabel } from '@/lib/unitLabels';
import { LineDimensionInputCells } from '@/components/inventory/LineDimensionInputCells';
import { LineDimensionViewCells } from '@/components/inventory/LineDimensionViewCells';
import {
  LINE_DIMENSION_COLS, clampDimensionField, itemDimensionUnit, normalizeUnit, clampSlabs, hasSize, isAreaUnit, isSized, withoutUnsupportedSize, withSizedQuantity,
} from '@/lib/lineDimensions';
import { blockEnterSubmit } from '@/lib/lineEntryKeys';
import { SlabEstimateRow } from './SlabEstimateRow';
import {
  EMPTY_LINE_ITEM, calcLineItem, clampPercent, type PurchaseOrderLineItem,
} from '@/lib/purchaseOrderForm';

const inlineCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-500 transition-all no-spinner';

let rowCounter = 0;
function genId() { rowCounter += 1; return `poli-${rowCounter}`; }

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
  { label: 'Unit Price', w: 'w-20', right: true },
  { label: 'Disc %', w: 'w-16', right: true },
  { label: 'Amount', w: 'w-20', right: true },
  { label: 'Tax %', w: 'w-16', right: true },
  { label: 'Total', w: 'w-20', right: true },
  { label: '', w: LINE_ACTIONS_HEAD_CLS },
];

// Mirrors EstimateItemsTab — a PO line has no free-text sku/units/tax% input;
// sku/units are display-only (populated when a catalog item is picked) and
// tax% always mirrors the header's Sales Tax % (purchaseOrderForm.ts's
// calcLineItem replicates the backend's stepwise round2 math exactly), since
// the backend has no per-line tax-rate picker UI yet (lkp_tax_rate has a
// single seeded "No Tax" row and no lookup endpoint). Description is the
// exception: it's a real, independently editable field.
export function PurchaseOrderItemsTab({ items, onUpdate, headerTaxPercent }: {
  items: PurchaseOrderLineItem[];
  onUpdate: (v: PurchaseOrderLineItem[]) => void;
  headerTaxPercent: number;
}) {
  const recalc = (next: Omit<PurchaseOrderLineItem, 'id' | 'lineNo'>) => {
    // Length x width x slabs, when stated, IS the quantity. The slab count is the
    // line's expected slabs, so it is passed in rather than read from `slabs`.
    const sized = withSizedQuantity(next, next.expectedSlabs);
    const { amount, total } = calcLineItem(sized, headerTaxPercent);
    return { ...sized, amount, total };
  };

  // Picking an inventory item snapshots its display fields into the draft;
  // the server re-snapshots authoritatively from inventoryItemUuid at save time.
  const unitCodeFor = useItemUnitCode();
  const applyCatalogItem = (prev: Omit<PurchaseOrderLineItem, 'id' | 'lineNo'>, item: InventoryItem) => {
    const units = unitCodeFor(item);
    return recalc(withoutUnsupportedSize({
      ...prev,
      itemName: item.name,
      units,
      tracking: item.tracking,
      // A slab count is kept for a slab-tracked item and for any area unit, where
      // it is the Slabs of a length x width x slabs line.
      expectedSlabs: item.tracking === TRACKING_SERIALIZED || isAreaUnit(units) ? prev.expectedSlabs : '',
      itemDescription: item.description,
      itemSku: item.sku,
      unitPrice: String(itemPrice(item, 'purchasing')),
      inventoryItemUuid: item.id,
      dimensionUnit: itemDimensionUnit(item),
    }));
  };

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
    const nextVal = key === 'discount' ? clampPercent(val) : key === 'expectedSlabs' ? clampSlabs(val) : clampDimensionField(key, val, draft.dimensionUnit);
    setDraft((prev) => recalc({ ...prev, [key]: nextVal }));
  };

  // Typing the item name detaches the line from any previously picked
  // inventory item — a fresh pick is required before the line can be saved.
  // The description is left untouched — it's independent of the item name.
  const onItemNameText = (text: string) => {
    setDraft((prev) => recalc(withoutUnsupportedSize({ ...prev, itemName: text, inventoryItemUuid: undefined, itemSku: '', units: '', tracking: undefined, expectedSlabs: '' })));
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

  const startEdit = (row: PurchaseOrderLineItem) => {
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

  // A slab line is ordered by count and average size; the helper fills in its area
  // quantity. Once a length and width are stated the exact area is worked out
  // from them, so the helper steps aside.
  const slabEstimate = draft.tracking === TRACKING_SERIALIZED && !hasSize(draft) ? (
    <tr className="bg-brand/5">
      <td colSpan={ITEM_COLS.length} className="border-t border-brand/10">
        <SlabEstimateRow
          key={editId ?? 'new'}
          quantity={draft.quantity}
          units={draft.units ?? ''}
          expectedSlabs={draft.expectedSlabs ?? ''}
          onChange={updateDraft}
        />
      </td>
    </tr>
  ) : null;

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
                <Fragment key={row.id}>
                <tr className="bg-brand/5 divide-x divide-stone-100">
                  <InlineItemRow lineNo={row.lineNo} draft={draft} onChange={updateDraft} picker={picker} />
                  <td className={LINE_ACTIONS_EDIT_CELL_CLS}>
                    <button type="button" onClick={() => remove(row.id)} className="text-stone-500 hover:text-destructive transition-colors" aria-label="Remove">
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
                {slabEstimate}
                </Fragment>
              ) : (
                <tr key={row.id} className="hover:bg-stone-50/70 transition-colors group divide-x divide-stone-100">
                  <td className="px-2.5 py-2.5 text-stone-500 tabular-nums">{row.lineNo}</td>
                  <td className="px-2.5 py-2.5 font-medium text-stone-800">{row.itemName || <span className="text-stone-500">—</span>}</td>
                  <td className="px-2.5 py-2.5 text-stone-500 max-w-[140px] truncate">{row.itemDescription || '—'}</td>
                  <td className="px-2.5 py-2.5 text-stone-500 font-mono text-2xs">{row.itemSku || '—'}</td>
                  <LineDimensionViewCells length={row.length} width={row.width} slabs={row.expectedSlabs} unit={row.dimensionUnit} />
                  <td className="px-2.5 py-2.5 text-stone-500 whitespace-nowrap" title={row.units || undefined}>{unitLabel(row.units) || '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">
                    {row.quantity}
                    {row.expectedSlabs && !hasSize(row) && <span className="block text-2xs font-normal text-stone-500">≈{row.expectedSlabs} slabs</span>}
                  </td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-600">{row.unitPrice ? `$${parseFloat(row.unitPrice).toFixed(2)}` : '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-500">{row.discount ? `${row.discount}%` : '0%'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-700 font-medium">{row.amount ? `$${row.amount}` : '—'}</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-500">{headerTaxPercent}%</td>
                  <td className="px-2.5 py-2.5 tabular-nums text-right text-stone-800 font-semibold">{row.total ? `$${row.total}` : '—'}</td>
                  <td className={LINE_ACTIONS_CELL_CLS}>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => startEdit(row)} className="text-stone-500 hover:text-stone-700 transition-colors" aria-label={`Edit line ${row.itemName || row.lineNo}`}>
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => remove(row.id)} className="text-stone-500 hover:text-destructive transition-colors" aria-label={`Remove line ${row.itemName || row.lineNo}`}>
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ),
            )}
            {isAdding && (
              <>
                <tr className="bg-brand/5 divide-x divide-stone-100">
                  <InlineItemRow lineNo={items.length + 1} draft={draft} onChange={updateDraft} picker={picker} />
                  <td className={LINE_ACTIONS_EDIT_CELL_CLS} />
                </tr>
                {slabEstimate}
              </>
            )}
          </tbody>
        </table>
      </div>

      {items.length === 0 && !isAdding && (
        <div className="flex flex-col items-center gap-1.5 py-8 text-center">
          <p className="text-xs text-stone-500">No line items yet.</p>
          <p className="text-2xs text-stone-500">Click <strong className="text-stone-500">+ Add Line</strong> to add an item.</p>
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

type DraftKey = 'quantity' | 'unitPrice' | 'discount' | 'itemDescription' | 'expectedSlabs' | 'length' | 'width';

function InlineItemRow({ lineNo, draft, onChange, picker }: {
  lineNo: number;
  draft: Omit<PurchaseOrderLineItem, 'id' | 'lineNo'>;
  onChange: (key: DraftKey, val: string) => void;
  picker: InventoryItemPickerHandlers;
}) {
  // Quantity is worked out from the dimensions while they are stated, so it is
  // shown but not editable.
  const sized = isSized(draft, draft.units);
  return (
    <>
      <td className="px-2.5 py-1.5 text-stone-500 tabular-nums">{lineNo}</td>
      <td className="px-2 py-1.5">
        <InventoryItemPicker {...picker} value={draft.itemName} className="min-w-[150px]" />
      </td>
      <td className="px-2 py-1.5">
        <input type="text" value={draft.itemDescription} onChange={(e) => onChange('itemDescription', e.target.value)} placeholder="Description" className={cn(inlineCls, 'min-w-[120px]')} aria-label="Description" />
      </td>
      <td className="px-2 py-1.5 text-stone-500 font-mono text-2xs">{draft.itemSku || '—'}</td>
      <LineDimensionInputCells
        dims={{ length: draft.length ?? '', width: draft.width ?? '', slabs: draft.expectedSlabs ?? '' }}
        unit={normalizeUnit(draft.dimensionUnit)}
        enabled={isAreaUnit(draft.units)}
        onChange={(key, val) => onChange(key === 'slabs' ? 'expectedSlabs' : key, val)}
      />
      <td className="px-2 py-1.5 text-stone-500 text-2xs whitespace-nowrap" title={draft.units || undefined}>{unitLabel(draft.units) || '—'}</td>
      <td className="px-2 py-1.5"><input type="number" min="0" step="any" value={draft.quantity} readOnly={sized} title={sized ? 'Worked out from length × width × slabs' : undefined} onChange={(e) => onChange('quantity', e.target.value)} placeholder="0" className={cn(inlineCls, 'w-16 text-right', sized && 'cursor-default bg-stone-50 text-stone-500')} aria-label="Quantity" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" step="0.01" value={draft.unitPrice} onChange={(e) => onChange('unitPrice', e.target.value)} placeholder="0.00" className={cn(inlineCls, 'w-20 text-right')} aria-label="Unit Price" /></td>
      <td className="px-2 py-1.5"><input type="number" min="0" max="100" step="any" value={draft.discount} onChange={(e) => onChange('discount', e.target.value)} placeholder="0" className={cn(inlineCls, 'w-14 text-right')} aria-label="Discount %" /></td>
      <td className="px-2 py-1.5"><input type="text" readOnly value={draft.amount ? `$${draft.amount}` : ''} className={cn(inlineCls, 'w-20 bg-stone-50 text-stone-500 cursor-default text-right')} aria-label="Amount" /></td>
      <td className="px-2 py-1.5 text-stone-500 text-2xs text-right">—</td>
      <td className="px-2 py-1.5"><input type="text" readOnly value={draft.total ? `$${draft.total}` : ''} className={cn(inlineCls, 'w-20 bg-stone-50 text-stone-800 font-semibold cursor-default text-right')} aria-label="Total" /></td>
    </>
  );
}
