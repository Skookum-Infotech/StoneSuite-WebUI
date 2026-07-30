import { Plus, Trash2 } from 'lucide-react';
import { ItemPicker } from '@/components/inventory/ItemPicker';
import { UnitPicker } from '@/components/inventory/UnitPicker';
import { fieldCls } from '@/components/crm/formUtils';
import { TRACKING_SERIALIZED } from '@/types/inventory';
import { emptyTransferLine, type TransferDraftLine } from '@/lib/inventoryTransferLines';

// A serialized line sends inventoryUnitId only — qty is ignored server-side
// (the slab moves whole or not at all, spec §8).
export function TransferLinesEditor({ lines, onChange, fromWarehouseId }: {
  lines: TransferDraftLine[];
  onChange: (lines: TransferDraftLine[]) => void;
  fromWarehouseId: string;
}) {
  function update(key: string, patch: Partial<TransferDraftLine>) {
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
                <div className="sm:col-span-2">
                  <UnitPicker itemId={line.item!.id} warehouseId={fromWarehouseId} value={line.unit} onChange={(unit) => update(line.key, { unit })} />
                </div>
              ) : (
                <input
                  type="number"
                  min={0}
                  value={line.qty}
                  onChange={(e) => update(line.key, { qty: e.target.value })}
                  placeholder="Quantity"
                  className={fieldCls}
                  aria-label={`Line ${i + 1} quantity`}
                  disabled={!line.item}
                />
              )}
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
      <button type="button" onClick={() => onChange([...lines, emptyTransferLine()])} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-stone-300 px-3 py-2 text-xs font-medium text-stone-500 hover:bg-stone-50">
        <Plus className="size-3.5" /> Add line
      </button>
    </div>
  );
}
