import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Boxes, ChevronLeft, ChevronRight, Pencil, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryService } from '@/services/inventoryService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import type { KitSearchRequest } from '@/types/inventory';

import { buttonVariants } from '@/components/ui/button';
const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;
const SKELETON_ROWS = 5;

/** The Kits tab of Inventory → Items: every kit, by name, with how many items
 *  it holds. A row opens the kit's own screen. */
export function KitTable() {
  const topRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('inventory_item', 'update');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(term.trim());
      setCursor('');
      setPrevCursors([]);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  const req: KitSearchRequest = {
    search: debounced || undefined,
    sort: [{ field: 'name', dir: 'asc' }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['inventory-kits', req],
    queryFn: () => inventoryService.searchKits(req),
    placeholderData: (prev) => prev,
  });

  const records = data?.records ?? [];
  const hasMore = data?.hasMore ?? false;
  const hasPrev = prevCursors.length > 0;
  const pageNum = prevCursors.length + 1;
  const colCount = canEdit ? 5 : 4;

  function scrollToTop() {
    topRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }

  function goNext() {
    if (!data?.nextCursor) return;
    setPrevCursors((p) => [...p, cursor]);
    setCursor(data.nextCursor);
    scrollToTop();
  }

  function goPrev() {
    const prev = prevCursors[prevCursors.length - 1] ?? '';
    setPrevCursors((p) => p.slice(0, -1));
    setCursor(prev);
    scrollToTop();
  }

  return (
    <div ref={topRef} className="flex flex-col gap-3 scroll-mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-faint" />
          <input
            type="text"
            placeholder="Search kit/packages by name…"
            aria-label="Search kit/packages"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150 type-input"
          />
        </div>
        {term && (
          <button
            type="button"
            onClick={() => setTerm('')}
            className={cn(buttonVariants({ variant: 'outline' }), 'flex')}
          >
            <X className="size-3" />
            Clear
          </button>
        )}
      </div>

      {isError && <p className="type-error">{apiErrorMessage(error, 'Failed to load kit/packages. Please try again.')}</p>}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[640px] text-left type-cell">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 py-3 type-th">Kit/Package</th>
                <th className="px-4 py-3 text-right type-th">Items</th>
                <th className="px-4 py-3 type-th">Description</th>
                <th className="px-4 py-3 type-th">Status</th>
                {canEdit && <th className="px-4 py-3 text-right type-th">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: SKELETON_ROWS }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: colCount }, (_, j) => (
                      <td key={j} className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    ))}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((kit) => (
                  <tr key={kit.id} className="group hover:bg-accent/10 transition-colors duration-150">
                    <td className="px-4 py-3.5">
                      {canEdit ? (
                        <Link
                          to={`/inventory/kit/${kit.id}`}
                          className="inline-flex items-center gap-2 text-xs font-semibold text-ink-strong hover:text-accent-foreground transition-colors"
                        >
                          <Boxes className="size-3.5 text-violet-500" aria-hidden="true" />
                          {kit.name}
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-2 text-xs font-semibold text-ink-strong">
                          <Boxes className="size-3.5 text-violet-500" aria-hidden="true" />
                          {kit.name}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 tabular-nums text-right type-cell">{kit.itemCount}</td>
                    <td className="px-4 py-3.5 truncate max-w-[280px] type-cell">{kit.description || '—'}</td>
                    <td className="px-4 py-3.5">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 whitespace-nowrap type-pill', kit.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-ink-muted')}>
                        <span className={cn('size-1.5 shrink-0 rounded-full', kit.isActive ? 'bg-emerald-500' : 'bg-stone-400')} aria-hidden="true" />
                        {kit.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-3.5 text-right">
                        <Link
                          to={`/inventory/kit/${kit.id}`}
                          aria-label={`Edit kit/package ${kit.name}`}
                          className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-ink-muted transition-colors hover:bg-accent hover:border-accent hover:text-accent-foreground cursor-pointer"
                        >
                          <Pencil className="size-4" />
                        </Link>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={colCount} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-2xl bg-violet-50 p-4">
                        {debounced ? <Search className="size-6 text-ink-faint" /> : <Boxes className="size-6 text-violet-400" />}
                      </div>
                      <p className="type-card-title">
                        {debounced ? 'No kit/packages match the current search.' : 'No kit/packages added yet.'}
                      </p>
                      <p className="type-helper">
                        {debounced
                          ? 'Try a different name.'
                          : 'A kit/package is a named group of items sold together, like “Kitchen”. Add your first with New Kit/Package.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {records.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/40">
            <p className="tabular-nums type-helper">Page {pageNum}{hasMore ? '' : ' · last page'}</p>
            <div className="flex items-center gap-1.5">
              <button onClick={goPrev} disabled={!hasPrev} className={cn(buttonVariants({ variant: 'outline' }), 'flex')} aria-label="Previous page">
                <ChevronLeft className="size-3.5" />
                Previous
              </button>
              <button onClick={goNext} disabled={!hasMore} className={cn(buttonVariants({ variant: 'outline' }), 'flex')} aria-label="Next page">
                Next
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
