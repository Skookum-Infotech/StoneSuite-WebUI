import { Plus, Trash2 } from 'lucide-react';
import { ItemPicker } from '@/components/inventory/ItemPicker';
import { UnitPicker } from '@/components/inventory/UnitPicker';
import { ReasonSelect } from '@/components/inventory/ReasonSelect';
import { fieldCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { TRACKING_SERIALIZED } from '@/types/inventory';
import { emptyAdjustmentLine, type AdjustmentDraftLine } from '@/lib/inventoryAdjustmentLines';

// A line is bulk (qtyDelta) or serialized (inventoryUnitId) — driven by the
// picked item's own tracking mode (spec §7). For a serialized line only the
// SIGN is sent; the magnitude is the slab's own area, computed server-side.
export function AdjustmentLinesEditor({ lines, onChange, warehouseId }: {
  lines: AdjustmentDraftLine[];
  onChange: (lines: AdjustmentDraftLine[]) => void;
  warehouseId: string;
}) {
  const { lookups } = useInventoryLookups();

  function update(key: string, patch: Partial<AdjustmentDraftLine>) {
    onChange(lines.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function remove(key: string) {
    onChange(lines.filter((l) => l.key !== key));
  }

  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        const serialized = line.item?.tracking === TRACKING_SERIALIZED;
        return (
          <div key={line.key} className="rounded-lg border border-stone-200 p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-2xs font-semibold text-stone-400">Line {i + 1}</span>
              <button type="button" onClick={() => remove(line.key)} aria-label={`Remove line ${i + 1}`} className="text-stone-400 hover:text-destructive"><Trash2 className="size-3.5" /></button>
            </div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <ItemPicker value={line.item} onChange={(item) => update(line.key, { item, unit: null })} />
              </div>
              {serialized ? (
                <>
                  <UnitPicker itemId={line.item!.id} warehouseId={warehouseId} value={line.unit} onChange={(unit) => update(line.key, { unit })} />
                  <div className="flex items-center gap-2">
                    <button type="button" onClick={() => update(line.key, { sign: -1 })} className={cn('flex-1 rounded-lg border px-3 py-2 text-xs font-semibold', line.sign === -1 ? 'border-destructive bg-destructive/10 text-destructive' : 'border-stone-200 text-stone-500')}>
                      − Write Off
                    </button>
                    <button type="button" onClick={() => update(line.key, { sign: 1 })} className={cn('flex-1 rounded-lg border px-3 py-2 text-xs font-semibold', line.sign === 1 ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-stone-200 text-stone-500')}>
                      + Bring Back
                    </button>
                  </div>
                </>
              ) : (
                <input
                  type="number"
                  value={line.qtyDelta}
                  onChange={(e) => update(line.key, { qtyDelta: e.target.value })}
                  placeholder="Qty delta (+ or −)"
                  className={fieldCls}
                  aria-label={`Line ${i + 1} quantity delta`}
                  disabled={!line.item}
                />
              )}
              <ReasonSelect reasons={lookups?.reasons ?? []} value={line.reasonId} onChange={(v) => update(line.key, { reasonId: v })} />
              <input
                type="text"
                value={line.notes}
                onChange={(e) => update(line.key, { notes: e.target.value })}
                placeholder="Notes (optional)"
                className={fieldCls}
                aria-label={`Line ${i + 1} notes`}
              />
            </div>
          </div>
        );
      })}
      <button type="button" onClick={() => onChange([...lines, emptyAdjustmentLine()])} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-xs font-medium text-stone-500 hover:bg-stone-50">
        <Plus className="size-3.5" /> Add line
      </button>
    </div>
  );
}
