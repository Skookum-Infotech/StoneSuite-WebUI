import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ModernSection, ModernFieldShell } from '@/components/crm/FormPrimitives';
import { fieldCls, fieldLabelCls, checkboxLabelCls } from '@/components/crm/formUtils';
import { LookupSelect } from '@/components/inventory/LookupSelect';
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { lookupService } from '@/services/lookupService';
import { findUnit, requiresDimensions } from '@/lib/inventoryUnits';
import { TRACKING_OPTIONS } from '@/lib/inventoryItemForm';

// Shared field layout for Add/Edit Item — the item form is small enough
// (no line items, no tabs) that a single body component covers both modes,
// mirroring EstimateFormBody's split for the larger sales forms scaled down.
export function ItemFormBody({ data, set }: {
  data: Record<string, unknown>;
  set: (key: string, value: unknown) => void;
}) {
  const { lookups } = useInventoryLookups();
  const { data: crmLookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });

  const units = lookups?.units ?? [];
  const selectedUnit = findUnit(units, Number(data.unit_id) || undefined);
  const showDimensions = requiresDimensions(selectedUnit);

  return (
    <div className="space-y-2">
      <ModernSection title="Primary Information" index={0}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <ModernFieldShell label="SKU" required>
            <input
              type="text"
              value={String(data.sku ?? '')}
              onChange={(e) => set('sku', e.target.value)}
              placeholder="e.g. GRAN-ABS-3CM"
              className={fieldCls}
              aria-label="SKU"
              required
            />
          </ModernFieldShell>
          <ModernFieldShell label="Item Name" required>
            <input
              type="text"
              value={String(data.name ?? '')}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Absolute Black Granite"
              className={fieldCls}
              aria-label="Item Name"
              required
            />
          </ModernFieldShell>
          <ModernFieldShell label="Unit" required>
            <LookupSelect
              kind="units"
              items={units}
              value={String(data.unit_id ?? '')}
              onChange={(v) => set('unit_id', v)}
              label="Unit"
              required
            />
          </ModernFieldShell>
          <ModernFieldShell label="Unit Price">
            <input
              type="number"
              min={0}
              step="0.01"
              value={String(data.unit_price ?? '')}
              onChange={(e) => set('unit_price', e.target.value)}
              placeholder="0.00"
              className={fieldCls}
              aria-label="Unit Price"
            />
          </ModernFieldShell>
          <ModernFieldShell label="Currency">
            <select
              value={String(data.currency_id ?? '')}
              onChange={(e) => set('currency_id', e.target.value)}
              className={fieldCls}
              aria-label="Currency"
            >
              <option value="">— Select Currency —</option>
              {(crmLookups?.currencies ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </ModernFieldShell>
          <ModernFieldShell label="Tax Rate">
            <LookupSelect
              kind="tax-rates"
              items={lookups?.['tax-rates'] ?? []}
              value={String(data.tax_rate_id ?? '')}
              onChange={(v) => set('tax_rate_id', v)}
              label="Tax Rate"
            />
          </ModernFieldShell>
          <ModernFieldShell label="Barcode">
            <input
              type="text"
              value={String(data.barcode ?? '')}
              onChange={(e) => set('barcode', e.target.value)}
              placeholder="Unique among live items"
              className={fieldCls}
              aria-label="Barcode"
            />
          </ModernFieldShell>
          <ModernFieldShell label="Default Warehouse">
            <WarehouseSelect
              warehouses={lookups?.warehouses ?? []}
              value={String(data.default_warehouse_id ?? '')}
              onChange={(v) => set('default_warehouse_id', v)}
              label="Default Warehouse"
            />
          </ModernFieldShell>
          <div className="flex items-center gap-2 pt-6">
            <input
              type="checkbox"
              id="item-is-active"
              checked={Boolean(data.is_active)}
              onChange={(e) => set('is_active', e.target.checked)}
              className="size-4 rounded border-stone-300 text-brand focus:ring-brand/30"
            />
            <label htmlFor="item-is-active" className={checkboxLabelCls}>Active</label>
          </div>
        </div>
        <label className={cn(fieldLabelCls, 'mt-4')}>Description</label>
        <textarea
          value={String(data.description ?? '')}
          onChange={(e) => set('description', e.target.value)}
          rows={3}
          placeholder="Notes about this item…"
          className={cn(fieldCls, 'h-auto resize-none mt-1.5')}
          aria-label="Description"
        />
      </ModernSection>

      <ModernSection title="Stone Attributes" index={1}>
        <div className="grid grid-cols-1 gap-x-5 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
          <ModernFieldShell label="Tracking">
            <select
              value={String(data.tracking ?? '')}
              onChange={(e) => set('tracking', e.target.value)}
              className={fieldCls}
              aria-label="Tracking"
            >
              {TRACKING_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </ModernFieldShell>
          <ModernFieldShell label="Material">
            <LookupSelect
              kind="materials"
              items={lookups?.materials ?? []}
              value={String(data.material_id ?? '')}
              onChange={(v) => set('material_id', v)}
              label="Material"
              allowInlineAdd
            />
          </ModernFieldShell>
          <ModernFieldShell label="Color">
            <LookupSelect
              kind="colors"
              items={lookups?.colors ?? []}
              value={String(data.color_id ?? '')}
              onChange={(v) => set('color_id', v)}
              label="Color"
              allowInlineAdd
              placeholder="— Select Color —"
            />
          </ModernFieldShell>
          <ModernFieldShell label="Finish">
            <LookupSelect
              kind="finishes"
              items={lookups?.finishes ?? []}
              value={String(data.finish_id ?? '')}
              onChange={(v) => set('finish_id', v)}
              label="Finish"
              allowInlineAdd
            />
          </ModernFieldShell>
          {showDimensions && (
            <ModernFieldShell label="Thickness (mm)">
              <input
                type="number"
                min={0}
                step="1"
                value={String(data.thickness_mm ?? '0')}
                onChange={(e) => set('thickness_mm', e.target.value)}
                placeholder="0 = n/a — typically 20 or 30"
                className={fieldCls}
                aria-label="Thickness (mm)"
              />
            </ModernFieldShell>
          )}
          <ModernFieldShell label="Origin Country">
            <select
              value={String(data.origin_country_id ?? '')}
              onChange={(e) => set('origin_country_id', e.target.value)}
              className={fieldCls}
              aria-label="Origin Country"
            >
              <option value="">— Select Country —</option>
              {(crmLookups?.countries ?? []).map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </ModernFieldShell>
        </div>
      </ModernSection>
    </div>
  );
}
