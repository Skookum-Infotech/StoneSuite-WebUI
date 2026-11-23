import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import type { InventoryItem, InventoryKit } from '@/types/inventory';
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
 *
 * Kits take the same trip: `addNewKit` goes to New Kit, and a kit created
 * there comes back as `returnedKit` for useAddKitLines to turn into lines.
 * `reportLineError` is how that hook says why a kit added nothing.
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
  // Captured at mount like `initial`, because consuming the pending line (just
  // below) clears it on the next render.
  const [returnedKit] = useState<InventoryKit | null>(() => pending?.createdKit ?? null);

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

  const startAddKit = inventoryReturn?.startAddKit;
  const addNewKit = startAddKit
    ? (kitName: string) => startAddKit(kitName, { draft, editId })
    : undefined;

  const reportLineError = useCallback((message: string) => setLineError(message), []);

  return {
    draft, setDraft, editId, setEditId, isAdding, setIsAdding, lineError, requireCatalogItem, addToInventory,
    addNewKit, returnedKit, reportLineError,
  };
}
