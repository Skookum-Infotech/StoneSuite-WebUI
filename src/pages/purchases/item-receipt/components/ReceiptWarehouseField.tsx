import { ModernFieldShell } from '@/components/crm/FormPrimitives';
import { WarehouseSelect } from '@/components/inventory/WarehouseSelect';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import type { ItemReceiptFormField } from '@/lib/itemReceiptForm';

// The receiving location — mandatory, since it is where the goods (and every
// slab's bin) live. Bound to the location uuid; the page turns it into the
// numeric id the receipt payload takes (lib/inventoryWarehouse.ts).
export function ReceiptWarehouseField({ field, value, set }: {
  field: ItemReceiptFormField;
  value: unknown;
  set: (k: string, v: unknown) => void;
}) {
  const { lookups } = useInventoryLookups();
  const selected = typeof value === 'string' ? value : '';
  const warehouses = lookups?.warehouses ?? [];

  return (
    <ModernFieldShell label={field.label} required={field.required}>
      <WarehouseSelect
        warehouses={warehouses}
        value={selected}
        onChange={(uuid) => set(field.key, uuid)}
        required={field.required}
      />
      {field.hint && <p className="text-2xs text-stone-400">{field.hint}</p>}
    </ModernFieldShell>
  );
}
