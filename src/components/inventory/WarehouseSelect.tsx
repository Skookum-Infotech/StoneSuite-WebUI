import { fieldCls } from '@/components/crm/formUtils';
import type { Warehouse } from '@/types/inventory';
import { cn } from '@/lib/utils';

// Warehouse <select>, bound to the warehouse UUID — the only id the
// GET /inventory/lookups and /inventory/warehouses endpoints expose. See
// lib/inventoryWarehouse.ts's `toNumericWarehouseId` for the numeric-id gap
// every document write contract runs into.
export function WarehouseSelect({
  warehouses, value, onChange, label = 'Warehouse', required, className,
}: {
  warehouses: Warehouse[];
  value: string;
  onChange: (uuid: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      aria-label={label}
      className={cn(fieldCls, className)}
    >
      <option value="">— Select {label} —</option>
      {warehouses.map((w) => (
        <option key={w.id} value={w.id}>{w.name}{w.isDefault ? ' (Default)' : ''}</option>
      ))}
    </select>
  );
}
