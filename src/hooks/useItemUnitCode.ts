import { useCallback } from 'react';
import { useInventoryLookups } from '@/hooks/useInventoryLookups';
import { unitCodeFor } from '@/lib/inventoryUnits';
import type { InventoryItem } from '@/types/inventory';

/**
 * Resolves a picked inventory item's unit code (SQFT, EA, ...) from the shared
 * inventory lookups. An item only carries its `unitId`, so without this the
 * Units column of a line stays blank until the document is saved and reloaded.
 * Returns '' while the lookups are still loading; the server re-snapshots the
 * authoritative unit from the item at save time regardless.
 */
export function useItemUnitCode(): (item: Pick<InventoryItem, 'unitId'>) => string {
  const { lookups } = useInventoryLookups();
  const units = lookups?.units;
  return useCallback((item) => unitCodeFor(units ?? [], item.unitId), [units]);
}
