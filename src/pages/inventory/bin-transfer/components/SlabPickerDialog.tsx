import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import { Layers, Loader2, Search, X } from 'lucide-react';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useModalDialog } from '@/hooks/useModalDialog';
import { cn } from '@/lib/utils';
import { UNIT_STATUS_AVAILABLE, UNIT_STATUS_RECEIVED, UNIT_STATUS_RESERVED } from '@/types/inventory';
import type { InventoryUnit } from '@/types/inventory';

const SEARCH_DEBOUNCE_MS = 300;
const PICKER_LIMIT = 30;

// Multi-select slab finder for a bin transfer, scoped to one location. Offers
// available and reserved slabs only — a consumed, scrapped or in-transit slab
// cannot be moved, and the server refuses it anyway. A slab already on the
// transfer is shown ticked and disabled rather than hidden, so a search for a
// serial that "isn't there" still explains itself.
export function SlabPickerDialog({ warehouseId, addedIds, onAdd, onClose }: {
  warehouseId: number;
  addedIds: ReadonlySet<string>;
  onAdd: (units: InventoryUnit[]) => void;
  onClose: () => void;
}) {
  const contentRef = useModalDialog(onClose);
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [picked, setPicked] = useState<ReadonlyMap<string, InventoryUnit>>(new Map());

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  const { data, isFetching, isError, error } = useQuery({
    queryKey: ['bin-transfer-slab-picker', warehouseId, debounced],
    queryFn: () => inventoryUnitService.searchUnits({
      search: debounced || undefined,
      filters: [
        { field: 'warehouse_id', op: 'eq', value: warehouseId },
        { field: 'status', op: 'in', value: [UNIT_STATUS_AVAILABLE, UNIT_STATUS_RECEIVED, UNIT_STATUS_RESERVED] },
      ],
      sort: [{ field: 'serial', dir: 'asc' }],
      limit: PICKER_LIMIT,
    }),
    placeholderData: (prev) => prev,
  });
  const results = data?.records ?? [];

  function toggle(unit: InventoryUnit) {
    setPicked((prev) => {
      const next = new Map(prev);
      if (next.has(unit.id)) next.delete(unit.id);
      else next.set(unit.id, unit);
      return next;
    });
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="slab-picker-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={contentRef} tabIndex={-1} className="mx-4 flex max-h-[80vh] w-full max-w-xl flex-col rounded-xl bg-white shadow-2xl outline-none">
        <div className="flex items-center justify-between gap-3 border-b border-stone-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent">
              <Layers className="size-4 text-accent-foreground" aria-hidden="true" />
            </div>
            <div>
              <h3 id="slab-picker-title" className="text-sm font-bold text-stone-900">Add slabs</h3>
              <p className="mt-0.5 text-xs text-stone-500">Slabs in this location that can be moved.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 text-stone-500 hover:bg-stone-100">
            <X className="size-4" />
          </button>
        </div>

        <div className="border-b border-stone-100 px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" aria-hidden="true" />
            <input
              type="text"
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search serial, item or lot…"
              aria-label="Search slabs"
              className="h-9 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-8 text-xs text-stone-900 placeholder:text-stone-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
            />
            {isFetching && <Loader2 className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 animate-spin text-stone-400" aria-hidden="true" />}
          </div>
        </div>

        <div className="min-h-[12rem] flex-1 overflow-y-auto modal-scrollbar px-2 py-2">
          {isError && <p role="alert" className="px-3 py-4 text-xs text-destructive">{apiErrorMessage(error, 'Failed to load slabs.')}</p>}
          {!isError && results.length === 0 && !isFetching && (
            <p className="px-3 py-10 text-center text-xs text-stone-500">
              {debounced ? 'No movable slabs match that search.' : 'No movable slabs in this location.'}
            </p>
          )}
          <ul className="space-y-0.5">
            {results.map((unit) => {
              const added = addedIds.has(unit.id);
              const checked = added || picked.has(unit.id);
              return (
                <li key={unit.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-stone-50',
                      added && 'cursor-not-allowed opacity-60 hover:bg-transparent',
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={added}
                      onChange={() => toggle(unit)}
                      aria-label={`Select ${unit.serial}`}
                      className="size-4 rounded border-stone-300 accent-brand"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold text-stone-900">{unit.serial}</span>
                        {unit.status === UNIT_STATUS_RECEIVED && (
                          <span className="rounded bg-cyan-100 px-1.5 py-0.5 text-2xs font-semibold text-cyan-700">Received</span>
                        )}
                        {unit.status === UNIT_STATUS_RESERVED && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-2xs font-semibold text-amber-700">Reserved</span>
                        )}
                        {added && <span className="text-2xs font-semibold text-stone-500">Already added</span>}
                      </span>
                      <span className="block truncate text-2xs text-stone-500">{unit.inventoryItemName ?? '—'}</span>
                    </span>
                    <span className="shrink-0 text-right">
                      <span className="block text-xs tabular-nums text-stone-700">
                        {unit.area.toFixed(2)} {unit.areaUnitCode ?? ''}
                      </span>
                      <span className="block text-2xs text-stone-500">{unit.binPath || 'No bin'}</span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-stone-100 px-5 py-3">
          <p className="text-xs text-stone-500" aria-live="polite">
            {picked.size === 0 ? 'Tick the slabs to move.' : `${picked.size} selected`}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-xs font-medium text-stone-600 hover:bg-stone-50">
              Cancel
            </button>
            <button
              type="button"
              disabled={picked.size === 0}
              onClick={() => onAdd([...picked.values()])}
              className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 shadow-sm transition-all hover:bg-brand-hover active:scale-95 disabled:opacity-50"
            >
              {picked.size > 0 ? `Add ${picked.size} slab${picked.size === 1 ? '' : 's'}` : 'Add slabs'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
