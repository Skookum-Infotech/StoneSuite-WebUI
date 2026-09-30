import { fieldCls } from '@/components/crm/formUtils';
import type { Warehouse } from '@/types/inventory';
import { cn } from '@/lib/utils';

// Location <select> over the tenant's Company Info locations, bound to the
// location uuid — the id GET /inventory/lookups exposes for a picker. See
// lib/inventoryWarehouse.ts for the numeric id every document write contract
// takes, and for `defaultWarehouseUuid`, which is what a new record starts on
// (the tenant's default location) before the user picks another.
//
// With no locations yet the field is disabled and says where to add one, since
// locations are created only under Configuration → Company Info → Locations.
export function WarehouseSelect({
  warehouses, value, onChange, label = 'Location', required, className,
}: {
  warehouses: Warehouse[];
  value: string;
  onChange: (uuid: string) => void;
  label?: string;
  required?: boolean;
  className?: string;
}) {
  const hasLocations = warehouses.length > 0;
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      required={required}
      disabled={!hasLocations}
      aria-label={label}
      className={cn(fieldCls, className)}
    >
      <option value="">
        {hasLocations ? `— Select ${label} —` : '— No locations yet: add one in Company Info —'}
      </option>
      {warehouses.map((w) => (
        <option key={w.id} value={w.id}>{w.name}{w.isDefault ? ' (Default)' : ''}</option>
      ))}
    </select>
  );
}
