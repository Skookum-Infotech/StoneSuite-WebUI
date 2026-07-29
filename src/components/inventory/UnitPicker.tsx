import { useState, useRef, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Loader2, Layers } from 'lucide-react';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import type { InventoryUnit } from '@/types/inventory';
import { UNIT_STATUS_AVAILABLE } from '@/types/inventory';
import { cn } from '@/lib/utils';
import { fieldCls } from '@/components/crm/formUtils';

const RESULT_LIMIT = 8;

// Serialized-unit picker scoped to a chosen catalog item — used by a
// document line once the item's tracking is 'serialized'. Only searches
// available units at the given warehouse (server-side filters `item_id`,
// `status`, `warehouse_id` — inventory/resolver_unit.go); an in_transit,
// reserved, consumed or scrapped slab is never offered here.
export function UnitPicker({
  itemId, warehouseId, value, onChange, required, className,
}: {
  /** Optional — when omitted, searches available units of any item (used to
   *  find an unexpected unit found in a count's scope). */
  itemId?: string;
  /** Numeric lkp_warehouse id, as a string — resolve with toNumericWarehouseId
   *  before passing in; the resolver's `warehouse_id` filter is TypeNumber. */
  warehouseId: string;
  value: InventoryUnit | null;
  onChange: (unit: InventoryUnit | null) => void;
  required?: boolean;
  className?: string;
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
    queryKey: ['inventory-unit-picker', itemId, warehouseId, debounced],
    enabled: open,
    staleTime: 15 * 1000,
    queryFn: async (): Promise<InventoryUnit[]> => {
      const numericWarehouseId = Number(warehouseId);
      const page = await inventoryUnitService.searchUnits({
        search: debounced || undefined,
        filters: [
          ...(itemId ? [{ field: 'item_id', op: 'eq' as const, value: itemId }] : []),
          ...(numericWarehouseId > 0 ? [{ field: 'warehouse_id', op: 'eq' as const, value: numericWarehouseId }] : []),
          { field: 'status', op: 'eq', value: UNIT_STATUS_AVAILABLE },
        ],
        limit: RESULT_LIMIT,
      });
      return page.records;
    },
  });

  function select(unit: InventoryUnit) {
    onChange(unit);
    setOpen(false);
    setTerm('');
    setDebounced('');
  }

  if (value) {
    return (
      <div className={cn('flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-3 py-2 text-sm', className)}>
        <Layers className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium text-stone-800">{value.serial}</span>
          <span className="block truncate text-2xs text-stone-400">
            {value.area.toFixed(2)} sq · {value.binPath || 'Unbinned'}
          </span>
        </span>
        <button
          type="button"
          onClick={() => onChange(null)}
          aria-label="Change unit"
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
          placeholder="Search serial…"
          className={cn(fieldCls, 'pl-8')}
          aria-label="Search inventory unit"
        />
        {isFetching && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-stone-400" />
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto modal-scrollbar">
          {results.length === 0 && !isFetching && (
            <p className="px-3 py-2 text-xs text-stone-400">{itemId ? 'No available units for this item.' : 'No available units found.'}</p>
          )}
          {results.map((unit) => (
            <button
              key={unit.id}
              type="button"
              onClick={() => select(unit)}
              className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent/10 transition-colors"
            >
              <Layers className="mt-0.5 size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium text-stone-800">{unit.serial}</span>
                <span className="block truncate text-2xs text-stone-400">
                  {unit.area.toFixed(2)} sq · {unit.binPath || 'Unbinned'}
                </span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
