// "Add to Inventory" round trip for document line items (quote, estimate,
// sales order, invoice, credit memo, PO, requisition, vendor bill).
//
// A line may only reference an inventory item. When the user types a name the
// catalog doesn't have, the document page stashes its unsaved form here (in
// sessionStorage, so it survives the route change but not the tab), sends the
// user to Inventory → New Item, and that page navigates back to `returnTo`
// with the created item in router state. The document page then restores the
// stash and re-opens the line with the new item picked.
import type { InventoryItem } from '@/types/inventory';

export const INVENTORY_ITEM_NEW_PATH = '/inventory/item/new';
export const RETURN_TO_PARAM = 'returnTo';
export const ITEM_NAME_PARAM = 'name';
/** Router-state key the New Item page sets when it sends the user back. */
export const INVENTORY_RETURN_STATE_KEY = 'inventoryItemReturn';

const STASH_KEY = 'stonesuite:inventory-item-return';

/** The items table's in-progress row at the moment the user left. */
export interface LineDraftStash<L = unknown> {
  draft: L;
  /** The line being edited, or null when it was a new (adding) row. */
  editId: string | null;
}

export interface InventoryReturnStash<P = unknown, L = unknown> {
  returnTo: string;
  page: P;
  line: LineDraftStash<L> | null;
}

export interface ResolvedInventoryReturn<P = unknown, L = unknown> {
  page: P;
  line: LineDraftStash<L> | null;
  createdItem: InventoryItem | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Only same-origin, in-app paths — never `//host` or an absolute URL. */
export function isSafeReturnPath(path: string | null | undefined): path is string {
  return typeof path === 'string'
    && path.startsWith('/')
    && !path.startsWith('//')
    && !path.startsWith('/\\');
}

export function newInventoryItemPath(returnTo: string, itemName: string): string {
  const params = new URLSearchParams({ [RETURN_TO_PARAM]: returnTo });
  const name = itemName.trim();
  if (name) params.set(ITEM_NAME_PARAM, name);
  return `${INVENTORY_ITEM_NEW_PATH}?${params.toString()}`;
}

/** Router state for navigating back to the document — `createdItem` is null
 *  when the user cancelled out of New Item. */
export function returnRouterState(createdItem: InventoryItem | null): Record<string, unknown> {
  return { [INVENTORY_RETURN_STATE_KEY]: { createdItem } };
}

/** Returns false when storage is unavailable (private mode, quota) so the
 *  caller can keep the user on the page instead of losing their work. */
export function writeReturnStash(stash: InventoryReturnStash): boolean {
  try {
    sessionStorage.setItem(STASH_KEY, JSON.stringify(stash));
    return true;
  } catch (err) {
    console.error('Failed to stash the document before adding an inventory item', err);
    return false;
  }
}

export function readReturnStash(): InventoryReturnStash | null {
  try {
    const raw = sessionStorage.getItem(STASH_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || typeof parsed.returnTo !== 'string') return null;
    return {
      returnTo: parsed.returnTo,
      page: parsed.page,
      line: isRecord(parsed.line) ? (parsed.line as unknown as LineDraftStash) : null,
    };
  } catch {
    // A corrupt or unreadable stash is treated as no stash — the document
    // simply opens fresh, which is what it would do without this feature.
    return null;
  }
}

export function clearReturnStash(): void {
  try {
    sessionStorage.removeItem(STASH_KEY);
  } catch {
    // Storage unavailable — nothing was stashed, so nothing to clear.
  }
}

function readCreatedItem(routerState: unknown): { returned: boolean; createdItem: InventoryItem | null } {
  if (!isRecord(routerState) || !isRecord(routerState[INVENTORY_RETURN_STATE_KEY])) {
    return { returned: false, createdItem: null };
  }
  const candidate = routerState[INVENTORY_RETURN_STATE_KEY].createdItem;
  const valid = isRecord(candidate) && typeof candidate.id === 'string' && typeof candidate.name === 'string';
  return { returned: true, createdItem: valid ? (candidate as unknown as InventoryItem) : null };
}

/**
 * Decides whether a document page mounting at `currentPath` should restore
 * the stash. It must be this page's stash, and the user must have come back
 * from New Item — either via its Save/Cancel (router state) or the browser's
 * back button (a POP navigation). A fresh in-app visit starts clean.
 */
export function resolveInventoryReturn<P, L>(
  stash: InventoryReturnStash | null,
  currentPath: string,
  routerState: unknown,
  isHistoryPop: boolean,
): ResolvedInventoryReturn<P, L> | null {
  if (!stash || stash.returnTo !== currentPath) return null;
  const { returned, createdItem } = readCreatedItem(routerState);
  if (!returned && !isHistoryPop) return null;
  return {
    page: stash.page as P,
    line: stash.line as LineDraftStash<L> | null,
    createdItem,
  };
}

/** Rebuilds the items table's row state from a restored line draft, with the
 *  newly created item applied through the table's own pick logic. */
export function applyReturnedLine<L>(
  line: LineDraftStash<L> | null,
  createdItem: InventoryItem | null,
  emptyDraft: L,
  applyItem: (draft: L, item: InventoryItem) => L,
): { draft: L; editId: string | null; isAdding: boolean } | null {
  if (!line && !createdItem) return null;
  const base = line?.draft ?? emptyDraft;
  const editId = line?.editId ?? null;
  return {
    draft: createdItem ? applyItem(base, createdItem) : base,
    editId,
    isAdding: editId === null,
  };
}

export function hasExactItemName(items: InventoryItem[], term: string): boolean {
  const needle = term.trim().toLowerCase();
  if (!needle) return false;
  return items.some((item) => item.name.trim().toLowerCase() === needle);
}
