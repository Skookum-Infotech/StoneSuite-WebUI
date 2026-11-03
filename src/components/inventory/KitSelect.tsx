import { useState, useRef, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Boxes, Loader2, Plus, Search, X } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryService } from '@/services/inventoryService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { fieldCls } from '@/components/crm/formUtils';
import { cn } from '@/lib/utils';
import type { KitRef } from '@/types/inventory';

const RESULT_LIMIT = 8;
const SEARCH_DEBOUNCE_MS = 250;
const RESULTS_STALE_MS = 30 * 1000;

/** Picks the kits an item belongs to, as chips. A name that is not a kit offers
 *  "Add as a new kit": the kit is created on the spot (name only — the item
 *  joins it when the item is saved) and chosen, so nobody leaves the item form. */
export function KitSelect({ value, onChange }: {
  value: KitRef[];
  onChange: (kits: KitRef[]) => void;
}) {
  const queryClient = useQueryClient();
  const { hasPermission } = useUserPermissions();
  const canCreate = hasPermission('inventory_item', 'create');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), SEARCH_DEBOUNCE_MS);
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

  const { data: found = [], isFetching } = useQuery({
    queryKey: ['inventory-kit-select', debounced],
    enabled: open,
    staleTime: RESULTS_STALE_MS,
    queryFn: async () => {
      const page = await inventoryService.searchKits({ search: debounced || undefined, limit: RESULT_LIMIT });
      return page.records.filter((kit) => kit.isActive);
    },
  });

  const chosen = new Set(value.map((k) => k.id));
  const choices = found.filter((kit) => !chosen.has(kit.id));
  const needle = debounced.toLowerCase();
  const nameTaken = needle !== '' && (
    found.some((kit) => kit.name.trim().toLowerCase() === needle)
    || value.some((kit) => kit.name.trim().toLowerCase() === needle)
  );
  const settled = debounced === term.trim();
  const canAddNew = canCreate && settled && !isFetching && debounced !== '' && !nameTaken;

  function choose(kit: KitRef) {
    onChange([...value, { id: kit.id, name: kit.name }]);
    setTerm('');
    setDebounced('');
    setOpen(false);
  }

  const create = useMutation({
    mutationFn: (name: string) => inventoryService.createKit({ name, description: '', members: [] }),
    onSuccess: (kit) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-kits'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-kit-select'] });
      choose(kit);
    },
  });

  return (
    <div ref={containerRef} className="relative">
      {value.length > 0 && (
        <ul aria-label="Kit/Packages this item is in" className="mb-2 flex flex-wrap gap-1.5">
          {value.map((kit) => (
            <li
              key={kit.id}
              className="inline-flex items-center gap-1.5 rounded-md bg-violet-100 py-1 pl-2 pr-1 text-xs font-semibold text-violet-900"
            >
              <Boxes className="size-3 shrink-0 text-violet-600" aria-hidden="true" />
              {kit.name}
              <button
                type="button"
                onClick={() => onChange(value.filter((k) => k.id !== kit.id))}
                aria-label={`Remove from kit/package ${kit.name}`}
                className="rounded p-0.5 text-violet-500 transition-colors hover:bg-violet-200 hover:text-violet-900"
              >
                <X className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
        <input
          type="text"
          value={term}
          onChange={(e) => { setTerm(e.target.value); setOpen(true); create.reset(); }}
          onFocus={() => setOpen(true)}
          placeholder="Search kit/packages to add this item to…"
          aria-label="Add to a kit/package"
          className={cn(fieldCls, 'pl-8')}
        />
        {(isFetching || create.isPending) && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 animate-spin text-stone-400" aria-hidden="true" />
        )}
      </div>

      {open && (
        <div className="absolute z-20 mt-1 w-full rounded-lg border border-stone-200 bg-white py-1 shadow-lg max-h-64 overflow-y-auto modal-scrollbar">
          {choices.length === 0 && !isFetching && !canAddNew && (
            <p className="px-3 py-2 text-xs text-stone-500">
              {debounced ? 'No more kit/packages match.' : 'No kit/packages to add. Type a name to create one.'}
            </p>
          )}
          {choices.map((kit) => (
            <button
              key={kit.id}
              type="button"
              onClick={() => choose(kit)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent/10"
            >
              <Boxes className="size-3.5 shrink-0 text-violet-500" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate text-xs font-medium text-stone-800">{kit.name}</span>
              <span className="shrink-0 text-2xs text-stone-500">
                {kit.itemCount} {kit.itemCount === 1 ? 'item' : 'items'}
              </span>
            </button>
          ))}
          {canAddNew && (
            <button
              type="button"
              onClick={() => create.mutate(debounced)}
              disabled={create.isPending}
              aria-label={`Add “${debounced}” as a new kit/package`}
              className="flex w-full items-center gap-2 border-t border-stone-100 px-3 py-2 text-left text-xs font-semibold text-stone-800 transition-colors hover:bg-accent/10 disabled:opacity-50"
            >
              <Plus className="size-3.5 shrink-0 text-stone-500" aria-hidden="true" />
              <span className="truncate">Add “{debounced}” as a new kit/package</span>
            </button>
          )}
          {create.error && (
            <p role="alert" className="border-t border-stone-100 px-3 py-2 text-xs font-medium text-destructive">
              {apiErrorMessage(create.error, 'Could not add that kit/package.')}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
