import type { InventoryItem, Warehouse } from '@/types/inventory';
import { fromItem, itemDefaults } from './inventoryItemForm';
import { copiedName, resetCopiedFields } from './recordCopy';

/** What a copied item must not inherit: its SKU and barcode (both must be
 *  unique among active items) and an inactive flag (a copy starts active). */
const ITEM_COPY_RESET_FIELDS = ['sku', 'barcode', 'is_active'] as const;

/** The Add Item form's starting state for "Copy item". */
export function fromItemForCopy(item: InventoryItem, warehouses: Warehouse[] = []): Record<string, unknown> {
  const mapped = fromItem(item, warehouses);
  return {
    ...resetCopiedFields(mapped, itemDefaults(), ITEM_COPY_RESET_FIELDS),
    name: copiedName(String(mapped.name ?? '')),
  };
}
