import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { toast } from 'sonner';
import type { InventoryItem } from '@/types/inventory';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import {
  clearReturnStash, newInventoryItemPath, readReturnStash, resolveInventoryReturn, writeReturnStash,
  type LineDraftStash,
} from '@/lib/inventoryItemReturn';

export interface InventoryItemReturnContextValue {
  /** The items-table row to re-open after coming back from New Item. Null
   *  once the table has consumed it, or when nothing was restored. */
  pendingLine: { line: LineDraftStash | null; createdItem: InventoryItem | null } | null;
  consumePendingLine: () => void;
  /** Stashes the document and goes to Inventory → New Item. Undefined when
   *  the user can't create inventory items — the picker then only warns. */
  startAddToInventory?: (itemName: string, line: LineDraftStash) => void;
}

export const InventoryItemReturnContext = createContext<InventoryItemReturnContextValue | null>(null);

export function useInventoryItemReturnContext(): InventoryItemReturnContextValue | null {
  return useContext(InventoryItemReturnContext);
}

export interface InventoryItemReturn<P> {
  /** The page's unsaved state from before it left for New Item — use it to
   *  seed the page's own useState initializers. Null on a normal visit. */
  restored: P | null;
  isRestored: boolean;
  /** Builds the context value for InventoryItemReturnContext from the page's
   *  current state. `onLeave` runs just before navigating (guard.markClean). */
  provide: (snapshot: P, onLeave?: () => void) => InventoryItemReturnContextValue;
}

const STASH_FAILED_MESSAGE = "Couldn't hold on to this page's unsaved changes, so you're staying here. Add the item in Inventory first.";

/**
 * Page half of the "Add to Inventory" round trip (see lib/inventoryItemReturn.ts).
 * A document Add/Edit page calls this before its own useState calls, seeds them
 * from `restored`, and wraps its form body in InventoryItemReturnContext with
 * `provide(snapshot)`. The items table picks the rest up via useCatalogLineDraft.
 */
export function useInventoryItemReturn<P>(): InventoryItemReturn<P> {
  const location = useLocation();
  const navigate = useNavigate();
  const isHistoryPop = useNavigationType() === 'POP';
  const { hasPermission } = useUserPermissions();
  const currentPath = `${location.pathname}${location.search}`;

  const [restored] = useState(() =>
    resolveInventoryReturn<P, unknown>(readReturnStash(), currentPath, location.state, isHistoryPop));
  const [lineConsumed, setLineConsumed] = useState(false);

  // Mounting the page a stash points at settles it, whether it was restored or
  // deliberately skipped — so a later fresh visit can't resurrect old work.
  useEffect(() => {
    if (readReturnStash()?.returnTo === currentPath) clearReturnStash();
  }, [currentPath]);

  const consumePendingLine = useCallback(() => setLineConsumed(true), []);
  const canCreateItems = hasPermission('inventory_item', 'create');

  const provide = (snapshot: P, onLeave?: () => void): InventoryItemReturnContextValue => ({
    pendingLine: restored && !lineConsumed ? { line: restored.line, createdItem: restored.createdItem } : null,
    consumePendingLine,
    startAddToInventory: canCreateItems
      ? (itemName, line) => {
        if (!writeReturnStash({ returnTo: currentPath, page: snapshot, line })) {
          toast.error(STASH_FAILED_MESSAGE);
          return;
        }
        onLeave?.();
        navigate(newInventoryItemPath(currentPath, itemName));
      }
      : undefined,
  });

  return { restored: restored?.page ?? null, isRestored: restored !== null, provide };
}
