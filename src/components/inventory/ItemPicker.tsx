import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, Package } from 'lucide-react';
import { inventoryService } from '@/services/inventoryService';
import type { FilterClause } from '@/types/tenant';
import type { InventoryItem } from '@/types/inventory';
import { TRACKING_SERIALIZED } from '@/types/inventory';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';

const RESULT_LIMIT = 8;

// Required catalog-only item picker for document lines (adjustment/transfer/
// count) and slab receiving. Unlike pages/sales/components/InventoryItemPicker
// (which allows a free-text fallback for a sales line's item name), a
// document line always references a real inventory_item_uuid — there is no
// free-text mode here.
export function ItemPicker({
  value, onChange, required, className, filters,
}: {
  value: InventoryItem | null;
  onChange: (item: InventoryItem | null) => void;
  required?: boolean;
  className?: string;
  /** Extra server-side filters, e.g. restrict to serialized items when
   *  receiving a slab. */
  filters?: FilterClause[];
}) {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['inventory-item-doc-picker', debounced, filters],
    enabled: open,
    staleTime: 30 * 1000,
    queryFn: async (): Promise<InventoryItem[]> => {
      const page = await inventoryService.searchItems({ search: debounced || undefined, filters, limit: RESULT_LIMIT });
      return page.records;
    },
  });

  function select(item: InventoryItem) {
    onChange(item);
    setOpen(false);
    setTerm('');
    setDebounced('');
  }

  if (value) {
    return (
      <div className={cn('flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm', className)}>
        <Package className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-stone-800">{value.name}</span>
          <span className="block truncate font-mono text-2xs text-stone-400">
            {value.sku} · {value.tracking === TRACKING_SERIALIZED ? 'Serialized' : 'Quantity'}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Change item"
          className="shrink-0 rounded p-0.5 text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
        >
          <X className="size-3.5" />
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
        <input
          type="text"
          required={required}
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder="Search item by SKU or name…"
          className={cn(fieldCls, 'pl-8')}
          aria-label="Search inventory item"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-stone-400" />
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto modal-scrollbar">
          {results.length === 0 && !isFetching && (
            <p className="px-3 py-2 text-xs text-stone-400">No matching items.</p>
          )}
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => select(item)}
              className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent/10 transition-colors"
            >
              <Package className="mt-0.5 size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-stone-800">{item.name}</span>
                <span className="block truncate font-mono text-2xs text-stone-400">
                  {item.sku} · {item.tracking === TRACKING_SERIALIZED ? 'Serialized' : 'Quantity'}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
