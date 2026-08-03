import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { X, Filter } from 'lucide-react';
import { fieldCls, fieldLabelCls } from '@/components/crm/formUtils';
import { lookupService } from '@/services/lookupService';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { useModalDialog } from '@/hooks/useModalDialog';
import { TRACKING_OPTIONS } from '@/lib/inventoryItemForm';
import { EMPTY_FILTER_STATE, type InventoryItemFilterState } from '@/lib/inventoryItemFilters';

// Filter drawer for the Inventory Item list — mirrors ItemReceiptFilterDrawer's
// "mount only while open" pattern. Covers every filterable field the item
// resolver whitelists (inventory/resolver.go), including the thickness_mm and
// unit_price ranges — "20mm vs 30mm" is a real query the backend supports.
export function ItemFilterDrawer({ onClose, value, onApply }: {
  onClose: () => void;
  value: InventoryItemFilterState;
  onApply: (next: InventoryItemFilterState) => void;
}) {
  const [draft, setDraft] = useState<InventoryItemFilterState>(value);
  const contentRef = useModalDialog(onClose);

  const { lookups } = useInventoryLookups();
  const { data: crmLookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const set = <K extends keyof InventoryItemFilterState>(key: K, val: InventoryItemFilterState[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex justify-end bg-black/40 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-filter-drawer-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="flex h-full w-full max-w-sm flex-col bg-white shadow-2xl outline-none">
        <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3.5 shrink-0">
          <div className="flex items-center gap-2">
            <Filter className="size-4 text-stone-500" aria-hidden="true" />
            <h2 id="item-filter-drawer-title" className="text-sm font-bold text-stone-900">Filters</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Close filters" className="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto modal-scrollbar px-4 py-4 space-y-5">
          <FilterField label="SKU">
            <input type="text" value={draft.sku} onChange={(e) => set('sku', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="SKU" />
          </FilterField>
          <FilterField label="Name">
            <input type="text" value={draft.name} onChange={(e) => set('name', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Name" />
          </FilterField>
          <FilterField label="Barcode">
            <input type="text" value={draft.barcode} onChange={(e) => set('barcode', e.target.value)} placeholder="Contains…" className={fieldCls} aria-label="Barcode" />
          </FilterField>
          <FilterField label="Tracking">
            <select value={draft.tracking} onChange={(e) => set('tracking', e.target.value)} className={fieldCls} aria-label="Tracking">
              <option value="">— Any —</option>
              {TRACKING_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FilterField>
          <FilterField label="Active">
            <select value={draft.isActive} onChange={(e) => set('isActive', e.target.value)} className={fieldCls} aria-label="Active">
              <option value="">— Any —</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </select>
          </FilterField>
          <FilterField label="Material">
            <select value={draft.materialId} onChange={(e) => set('materialId', e.target.value)} className={fieldCls} aria-label="Material">
              <option value="">— Any —</option>
              {(lookups?.materials ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </FilterField>
          <FilterField label="Color">
            <select value={draft.colorId} onChange={(e) => set('colorId', e.target.value)} className={fieldCls} aria-label="Color">
              <option value="">— Any —</option>
              {(lookups?.colors ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FilterField>
          <FilterField label="Finish">
            <select value={draft.finishId} onChange={(e) => set('finishId', e.target.value)} className={fieldCls} aria-label="Finish">
              <option value="">— Any —</option>
              {(lookups?.finishes ?? []).map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
          </FilterField>
          <FilterField label="Origin Country">
            <select value={draft.originCountryId} onChange={(e) => set('originCountryId', e.target.value)} className={fieldCls} aria-label="Origin Country">
              <option value="">— Any —</option>
              {(crmLookups?.countries ?? []).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </FilterField>
          <FilterField label="Default Warehouse">
            <select value={draft.defaultWarehouseId} onChange={(e) => set('defaultWarehouseId', e.target.value)} className={fieldCls} aria-label="Default Warehouse">
              <option value="">— Any —</option>
              {(lookups?.warehouses ?? []).map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </FilterField>
          <FilterField label="Thickness (mm)">
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={0} value={draft.thicknessMin} onChange={(e) => set('thicknessMin', e.target.value)} placeholder="Min" className={fieldCls} aria-label="Thickness min" />
              <input type="number" min={0} value={draft.thicknessMax} onChange={(e) => set('thicknessMax', e.target.value)} placeholder="Max" className={fieldCls} aria-label="Thickness max" />
            </div>
          </FilterField>
          <FilterField label="Unit Price">
            <div className="grid grid-cols-2 gap-2">
              <input type="number" min={0} value={draft.unitPriceMin} onChange={(e) => set('unitPriceMin', e.target.value)} placeholder="Min" className={fieldCls} aria-label="Unit price min" />
              <input type="number" min={0} value={draft.unitPriceMax} onChange={(e) => set('unitPriceMax', e.target.value)} placeholder="Max" className={fieldCls} aria-label="Unit price max" />
            </div>
          </FilterField>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-stone-200 px-4 py-3 shrink-0">
          <button type="button" onClick={() => setDraft(EMPTY_FILTER_STATE)} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50 transition-colors">
            Clear all
          </button>
          <button type="button" onClick={() => { onApply(draft); onClose(); }} className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 hover:bg-brand-hover transition-colors shadow-sm">
            Apply Filters
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className={fieldLabelCls}>{label}</label>
      {children}
    </div>
  );
}
