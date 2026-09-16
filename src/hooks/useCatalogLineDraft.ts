import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { InventoryItem } from '@/types/inventory';
import { applyReturnedLine, type LineDraftStash } from '@/lib/inventoryItemReturn';
import { useInventoryItemReturnContext } from '@/hooks/useInventoryItemReturn';

export const CATALOG_ITEM_REQUIRED_MESSAGE = 'Select an item from inventory before saving this line.';

export interface CatalogLineDraftFields {
  itemName: string;
  inventoryItemUuid?: string;
}

/**
 * Row state for a document's inline items table — the draft line plus which
 * row is open — shared by every document type that picks inventory items.
 *
 * Lines are inventory-only: `requireCatalogItem` gates Save Line on a picked
 * item, and `addToInventory` starts the New Item round trip
 * (useInventoryItemReturn). When the page was restored from that round trip,
 * the row the user left re-opens with the created item already picked, via
 * the table's own `applyItem`.
 */
export function useCatalogLineDraft<D extends CatalogLineDraftFields>(
  emptyDraft: D,
  applyItem: (draft: D, item: InventoryItem) => D,
) {
  const inventoryReturn = useInventoryItemReturnContext();
  const pending = inventoryReturn?.pendingLine ?? null;

  const [initial] = useState(() => applyReturnedLine(
    (pending?.line ?? null) as LineDraftStash<D> | null,
    pending?.createdItem ?? null,
    emptyDraft,
    applyItem,
  ));
  const [draft, setDraftState] = useState<D>(initial?.draft ?? emptyDraft);
  const [editId, setEditId] = useState<string | null>(initial?.editId ?? null);
  const [isAdding, setIsAdding] = useState(initial?.isAdding ?? false);
  const [lineError, setLineError] = useState<string | null>(null);

  // Re-open the returned row once — switching page tabs remounts this table,
  // and that should start clean like it always has.
  const hasPending = pending !== null;
  const consumePendingLine = inventoryReturn?.consumePendingLine;
  useEffect(() => {
    if (hasPending) consumePendingLine?.();
  }, [hasPending, consumePendingLine]);

  // Any draft change — typing, picking, cancelling, committing — retires a
  // stale "select an item" error.
  const setDraft = useCallback<Dispatch<SetStateAction<D>>>((next) => {
    setLineError(null);
    setDraftState(next);
  }, []);

  const requireCatalogItem = (): boolean => {
    if (draft.inventoryItemUuid) return true;
    setLineError(CATALOG_ITEM_REQUIRED_MESSAGE);
    return false;
  };

  const startAddToInventory = inventoryReturn?.startAddToInventory;
  const addToInventory = startAddToInventory
    ? (itemName: string) => startAddToInventory(itemName, { draft, editId })
    : undefined;

  return { draft, setDraft, editId, setEditId, isAdding, setIsAdding, lineError, requireCatalogItem, addToInventory };
}
