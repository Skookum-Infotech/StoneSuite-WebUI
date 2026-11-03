import { useState, useRef, useEffect, useCallback, useId, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Boxes, Loader2, Package, PackagePlus } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import type { InventoryItem, InventoryKit } from '@/types/inventory';
import { cn } from '@/lib/utils';
import { hasExactItemName } from '@/lib/inventoryItemReturn';
import { itemPrice, type ItemPriceKind } from '@/lib/itemPrice';
import { useFloatingDropdownPosition } from '@/hooks/useFloatingDropdownPosition';

const MIN_CHARS = 2;
const RESULT_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 250;
const RESULTS_STALE_MS = 30 * 1000;
const PANEL_WIDTH = 288; // w-72

const inputCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-500 transition-all';

export interface InventoryItemPickerHandlers {
  onPick: (item: InventoryItem) => void;
  onTextChange: (text: string) => void;
  /** Sends the user to Inventory → New Item for a name the catalog doesn't
   *  have. Omitted when the user can't create items — the warning still shows. */
  onAddToInventory?: (itemName: string) => void;
  /** Picking a kit adds all of its items as lines. When omitted, kits are
   *  neither searched for nor listed — the picker is items-only, as it is while
   *  editing a line that already exists. */
  onPickKit?: (kit: InventoryKit) => void;
  /** Sends the user to Inventory → New Kit for a name that is not a kit. Only
   *  offered alongside `onPickKit`, and omitted when the user can't create. */
  onAddKit?: (kitName: string) => void;
  /** Which of an item's two prices the dropdown shows: 'purchasing' on a
   *  purchase document, 'selling' (the default) on a sales one. */
  priceKind?: ItemPriceKind;
}

function hasExactName(list: { name: string }[], term: string): boolean {
  const needle = term.trim().toLowerCase();
  return needle !== '' && list.some((entry) => entry.name.trim().toLowerCase() === needle);
}

// Search-as-you-type inventory picker for a document line's item name cell.
// Lines are inventory-only: typed text just searches, and the owning table
// refuses to save a line until an item is picked (useCatalogLineDraft).
//
// Kits ride in the same list (see `onPickKit`): a kit is not a line itself —
// choosing one adds all of its items — so it is marked KIT and listed after the
// items. A name that matches neither gets both "Add to Inventory" and, when
// kits are enabled, "Add as a Kit".
//
// The results panel is portaled to document.body with fixed positioning —
// the items table sits inside an overflow-x-auto/overflow-hidden wrapper that
// would otherwise clip the panel underneath the table's edge (same approach
// as StatusSelect's 'pill' variant).
export function InventoryItemPicker({
  value, onPick, onTextChange, onAddToInventory, onPickKit, onAddKit, priceKind = 'selling', className,
}: InventoryItemPickerHandlers & {
  value: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState('');
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [value]);

  const close = useCallback(() => {
    setOpen(false);
    setActiveIndex(-1);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  const enabled = open && debounced.length >= MIN_CHARS;
  const kitsEnabled = enabled && Boolean(onPickKit);
  const position = useFloatingDropdownPosition(enabled, containerRef, close, PANEL_WIDTH, panelRef);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['inventory-item-picker', debounced],
    enabled,
    staleTime: RESULTS_STALE_MS,
    queryFn: async (): Promise<InventoryItem[]> => {
      const page = await inventoryService.searchItems({ search: debounced, limit: RESULT_LIMIT });
      return page.records;
    },
  });

  // Only active kits are offered, like a picker that lists only usable records.
  const { data: kitResults = [], isFetching: kitsFetching } = useQuery({
    queryKey: ['inventory-kit-picker', debounced],
    enabled: kitsEnabled,
    staleTime: RESULTS_STALE_MS,
    queryFn: async (): Promise<InventoryKit[]> => {
      const page = await inventoryService.searchKits({ search: debounced, limit: RESULT_LIMIT });
      return page.records.filter((kit) => kit.isActive);
    },
  });
  const shownKits = kitsEnabled ? kitResults : [];

  // While the typed text is still debouncing, `results` belong to the previous
  // term; judging "not in inventory" then would warn about text already replaced.
  const settled = debounced === value.trim();
  const searching = isFetching || (kitsEnabled && kitsFetching);
  const nothingFound = settled && !searching && results.length === 0 && shownKits.length === 0;
  const showAddAction = Boolean(onAddToInventory) && settled && !isFetching && !hasExactItemName(results, debounced);
  const showAddKit = Boolean(onAddKit) && kitsEnabled && settled && !kitsFetching && !hasExactName(shownKits, debounced);

  const kitStart = results.length;
  const addItemIndex = kitStart + shownKits.length;
  const addKitIndex = addItemIndex + (showAddAction ? 1 : 0);
  const optionCount = addKitIndex + (showAddKit ? 1 : 0);
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  function select(item: InventoryItem) {
    onPick(item);
    close();
  }

  function selectKit(kit: InventoryKit) {
    onPickKit?.(kit);
    close();
  }

  function addToInventory() {
    close();
    onAddToInventory?.(debounced);
  }

  function addKit() {
    close();
    onAddKit?.(debounced);
  }

  function choose(index: number) {
    if (index < kitStart) select(results[index]);
    else if (index < addItemIndex) selectKit(shownKits[index - kitStart]);
    else if (showAddAction && index === addItemIndex) addToInventory();
    else if (showAddKit && index === addKitIndex) addKit();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
      if (optionCount === 0) return;
      const step = e.key === 'ArrowDown' ? 1 : -1;
      setActiveIndex((i) => (i + step + optionCount) % optionCount);
    } else if (e.key === 'Enter' && enabled && activeIndex >= 0 && activeIndex < optionCount) {
      // Without this, Enter would submit the whole document form.
      e.preventDefault();
      choose(activeIndex);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      close();
    }
  }

  const optionCls = (index: number) => cn(
    'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/10',
    activeIndex === index && 'bg-accent/10',
  );

  // With kits on, a name can be added either way, so the hint says both.
  const addHint = kitsEnabled ? 'Add it to inventory, or as a kit, to use it here.' : 'Add it to inventory to use it here.';

  return (
    <div ref={containerRef} className="relative">
      <input
        autoFocus
        type="text"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={enabled}
        aria-controls={enabled ? listboxId : undefined}
        aria-activedescendant={enabled && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        value={value}
        onChange={(e) => { onTextChange(e.target.value); setOpen(true); setActiveIndex(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={onPickKit ? 'Search items or kits…' : 'Search inventory…'}
        className={cn(inputCls, className)}
        aria-label="Item Name"
      />
      {searching && (
        <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 animate-spin text-stone-400" aria-hidden="true" />
      )}
      {enabled && position && createPortal(
        <div
          ref={panelRef}
          className="fixed z-50 max-h-64 overflow-y-auto rounded-lg border border-stone-200 bg-white py-1 shadow-lg modal-scrollbar"
          style={{ left: position.left, top: position.top, bottom: position.bottom, width: PANEL_WIDTH }}
        >
          <div role="status">
            {results.length === 0 && shownKits.length === 0 && (searching || !settled) && (
              <p className="px-3 py-2 text-2xs text-stone-500">Searching inventory…</p>
            )}
            {nothingFound && (
              <div className="px-3 py-2">
                <p className="flex items-start gap-1.5 text-xs font-medium text-amber-700">
                  <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                  <span className="min-w-0 break-words">“{debounced}” isn't in inventory.</span>
                </p>
                <p className="mt-0.5 pl-5 text-2xs text-stone-500">
                  {onAddToInventory
                    ? `Line items can only use inventory items${kitsEnabled ? ' or kits' : ''}. ${addHint}`
                    : 'Line items can only use inventory items. Ask someone with inventory access to add it.'}
                </p>
              </div>
            )}
          </div>
          <div id={listboxId} role="listbox" aria-label="Inventory items">
            {results.map((item, index) => (
              <button
                key={item.id}
                id={optionId(index)}
                type="button"
                role="option"
                aria-selected={activeIndex === index}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => select(item)}
                className={optionCls(index)}
              >
                <Package className="mt-0.5 size-3 shrink-0 text-stone-400" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-xs font-medium text-stone-800">{item.name}</span>
                  <span className="block truncate font-mono text-2xs text-stone-500">
                    {item.sku} · ${itemPrice(item, priceKind).toFixed(2)}
                  </span>
                </span>
              </button>
            ))}
            {shownKits.map((kit, offset) => {
              const index = kitStart + offset;
              return (
                <button
                  key={kit.id}
                  id={optionId(index)}
                  type="button"
                  role="option"
                  aria-selected={activeIndex === index}
                  tabIndex={-1}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => selectKit(kit)}
                  className={cn(optionCls(index), 'bg-violet-50/60')}
                >
                  <Boxes className="mt-0.5 size-3 shrink-0 text-violet-500" aria-hidden="true" />
                  <span className="min-w-0">
                    {/* The literal spaces keep the option's spoken name readable:
                        "Kitchen KIT 4 items", not "KitchenKIT4 items". */}
                    <span className="flex items-center gap-1.5 text-xs font-medium text-stone-800">
                      <span className="truncate">{kit.name}</span>{' '}
                      <span className="shrink-0 rounded bg-violet-700 px-1 py-px text-2xs font-bold text-white">KIT</span>
                    </span>{' '}
                    <span className="block truncate text-2xs text-stone-500">
                      {kit.itemCount} {kit.itemCount === 1 ? 'item' : 'items'}
                    </span>
                  </span>
                </button>
              );
            })}
            {showAddAction && (
              <button
                id={optionId(addItemIndex)}
                type="button"
                role="option"
                aria-selected={activeIndex === addItemIndex}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={addToInventory}
                className={cn(optionCls(addItemIndex), 'items-center border-t border-stone-100 font-semibold')}
              >
                <PackagePlus className="size-3.5 shrink-0 text-stone-500" aria-hidden="true" />
                <span className="min-w-0 truncate text-xs text-stone-800">Add “{debounced}” to Inventory</span>
              </button>
            )}
            {showAddKit && (
              <button
                id={optionId(addKitIndex)}
                type="button"
                role="option"
                aria-selected={activeIndex === addKitIndex}
                tabIndex={-1}
                onMouseDown={(e) => e.preventDefault()}
                onClick={addKit}
                className={cn(optionCls(addKitIndex), 'items-center border-t border-stone-100 font-semibold')}
              >
                <Boxes className="size-3.5 shrink-0 text-violet-500" aria-hidden="true" />
                <span className="min-w-0 truncate text-xs text-stone-800">Add “{debounced}” as a Kit</span>
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
