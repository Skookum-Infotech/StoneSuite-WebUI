import { X } from 'lucide-react';
import { fieldCls } from '@/components/crm/formUtils';
import { VendorPicker } from '@/pages/purchases/purchase-order/components/VendorPicker';
import type { VendorSplitRow } from '@/lib/replenishment';

/** One vendor and the quantity to order from them. */
export function VendorSplitLine({ row, step, canRemove, onChange, onRemove }: {
  row: VendorSplitRow;
  step: string;
  canRemove: boolean;
  onChange: (next: VendorSplitRow) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_6rem_2.25rem] items-start gap-2">
      <VendorPicker value={row.vendor} onChange={(vendor) => onChange({ ...row, vendor })} />
      <input
        type="number"
        min={0}
        step={step}
        value={row.qty}
        onChange={(e) => onChange({ ...row, qty: e.target.value })}
        className={fieldCls}
        aria-label="Quantity to order from this vendor"
      />
      <button
        type="button"
        onClick={onRemove}
        disabled={!canRemove}
        aria-label="Remove this vendor"
        className="flex h-10 items-center justify-center rounded-lg text-stone-400 transition-colors hover:bg-stone-100 hover:text-stone-700 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <X className="size-4" aria-hidden="true" />
      </button>
    </div>
  );
}
