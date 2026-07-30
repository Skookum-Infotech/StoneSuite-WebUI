import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Loader2, Package } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import type { InventoryItem } from '@/types/inventory';
import { cn } from '@/lib/utils';

const MIN_CHARS = 2;
const RESULT_LIMIT = 8;

const inputCls =
  'w-full rounded border border-stone-200 bg-white px-2 py-1 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5 placeholder:text-stone-300 transition-all';

// Search-as-you-type catalog picker for a sales order line's item name cell.
// Typing without picking a suggestion keeps the line free-text (no
// inventoryItemUuid) — the backend supports both a catalog reference and a
// plain description-only line (spec §10).
export function InventoryItemPicker({
  value,
  onPick,
  onTextChange,
  className,
}: {
  value: string;
  onPick: (item: InventoryItem) => void;
  onTextChange: (text: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [debounced, setDebounced] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(value.trim()), 250);
    return () => clearTimeout(t);
  }, [value]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const enabled = open && debounced.length >= MIN_CHARS;

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['inventory-item-picker', debounced],
    enabled,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<InventoryItem[]> => {
      const page = await inventoryService.searchItems({ search: debounced, limit: RESULT_LIMIT });
      return page.records;
    },
  });

  function select(item: InventoryItem) {
    onPick(item);
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => { onTextChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder="Item name or search catalog…"
        className={cn(inputCls, className)}
        aria-label="Item Name"
      />
      {isFetching && (
        <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 size-3 animate-spin text-stone-400" />
      )}
      {enabled && (
        <div className="absolute z-20 mt-1 w-56 rounded-lg border border-stone-200 bg-white py-1 shadow-lg max-h-56 overflow-y-auto modal-scrollbar">
          {results.length === 0 && !isFetching && (
            <p className="px-2.5 py-1.5 text-2xs text-stone-400">No catalog items found — this will save as a free-text line.</p>
          )}
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => select(item)}
              className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left hover:bg-accent/10 transition-colors"
            >
              <Package className="mt-0.5 size-3 shrink-0 text-stone-400" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-stone-800">{item.name}</span>
                <span className="block truncate font-mono text-2xs text-stone-400">
                  {item.sku} · ${item.unitPrice.toFixed(2)}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
