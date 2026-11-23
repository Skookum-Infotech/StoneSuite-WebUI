import { useState } from 'react';
import type { Warehouse } from '@/types/inventory';
import { defaultWarehouseUuid } from '@/lib/inventoryWarehouse';

/**
 * State for a form's location picker: it starts on the tenant's default
 * location (set in Configuration → Company Info → Locations) and the user can
 * choose another.
 *
 * The default is derived rather than copied into state, because the lookups
 * arrive after the form mounts — so it fills in as soon as they load, and once
 * the user has picked something it is never overwritten by a later refetch.
 * Returns `[value, setValue]` like `useState`; `value` is a location uuid.
 */
export function useDefaultLocation(warehouses: Warehouse[]): [string, (uuid: string) => void] {
  const [picked, setPicked] = useState<string | null>(null);
  return [picked ?? defaultWarehouseUuid(warehouses), setPicked];
}
