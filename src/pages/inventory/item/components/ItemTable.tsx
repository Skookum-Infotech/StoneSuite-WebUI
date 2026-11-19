import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, X, Package, Pencil, Filter,
  ChevronLeft, ChevronRight, Download, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryService } from '@/services/inventoryService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { exportPagedCsv } from '@/lib/csvExport';
import { itemPrice } from '@/lib/itemPrice';
import { TRACKING_SERIALIZED } from '@/types/inventory';
import { EMPTY_FILTER_STATE, hasActiveFilters, toFilterClauses, type InventoryItemFilterState } from '@/lib/inventoryItemFilters';
import { ItemFilterDrawer } from './ItemFilterDrawer';
import type { InventoryItemSearchRequest } from '@/types/inventory';

import { buttonVariants } from '@/components/ui/button';
const EXPORT_PAGE_SIZE = 200;

type SortField = 'sku' | 'name';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

const SORT_LABELS: Record<SortField, string> = { sku: 'SKU', name: 'Name' };

export function ItemTable() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('inventory_item', 'update');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filters, setFilters] = useState<InventoryItemFilterState>(EMPTY_FILTER_STATE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(term.trim());
      setCursor('');
      setPrevCursors([]);
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const req: InventoryItemSearchRequest = {
    search: debounced || undefined,
    filters: toFilterClauses(filters),
    sort: [{ field: sortBy, dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['inventory-items', req],
    queryFn: () => inventoryService.searchItems(req),
    placeholderData: (prev) => prev,
  });

  const records = data?.records ?? [];
  const hasMore = data?.hasMore ?? false;
  const hasPrev = prevCursors.length > 0;
  const pageNum = prevCursors.length + 1;

  function scrollToTop() {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
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

  const filtersActive = hasActiveFilters(filters);
  const hasFilters = Boolean(term) || filtersActive;

  function clearFilters() {
    setTerm('');
    setFilters(EMPTY_FILTER_STATE);
    setCursor('');
    setPrevCursors([]);
  }

  function applyFilters(next: InventoryItemFilterState) {
    setFilters(next);
    setCursor('');
    setPrevCursors([]);
  }

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
    setCursor('');
    setPrevCursors([]);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <ArrowUpDown className="size-2.5 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />;
  }

  async function handleDownloadCsv() {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportPagedCsv(
        (exportCursor) => inventoryService.searchItems({ ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor }),
        ['SKU', 'Name', 'Tracking', 'Purchasing Unit Price', 'Selling Unit Price', 'Barcode', 'Active'],
        (it) => [
          it.sku, it.name, it.tracking,
          itemPrice(it, 'purchasing').toFixed(2), itemPrice(it, 'selling').toFixed(2),
          it.barcode ?? '', it.isActive ? 'Yes' : 'No',
        ],
        'Inventory Item',
      );
    } catch (err) {
      setExportError(apiErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div ref={topRef} className="flex flex-col gap-3 scroll-mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-faint" />
          <input
            type="text"
            placeholder="Search SKU or name…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150 type-input"
          />
        </div>

        <button
          onClick={() => setFiltersOpen(true)}
          className={cn(
            'flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors',
            filtersActive ? 'border-brand/40 bg-accent text-accent-foreground' : 'border-stone-200 bg-white text-ink-muted hover:bg-stone-50',
          )}
        >
          <Filter className="size-3.5" />
          Filters
        </button>

        <div className="h-5 w-px bg-stone-200" aria-hidden="true" />

        <div className="flex items-center gap-1.5">
          <span className="pr-0.5 type-overline">Sort:</span>
          {(Object.entries(SORT_LABELS) as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-micro font-semibold transition-colors',
                sortBy === field ? 'bg-accent text-accent-foreground ring-1 ring-accent-foreground/20' : 'bg-white border border-stone-200 text-ink-muted hover:border-stone-300 hover:text-ink',
              )}
            >
              {label}
              <SortIcon field={field} />
            </button>
          ))}
        </div>

        {hasFilters && (
          <button onClick={clearFilters} className={cn(buttonVariants({ variant: 'outline' }), 'flex')}>
            <X className="size-3" />
            Clear
          </button>
        )}

        {records.length > 0 && (
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={isExporting}
            aria-label={hasFilters ? 'Download filtered items as CSV' : 'Download all items as CSV'}
            className={cn(buttonVariants({ variant: 'outline' }), 'ml-auto flex')}
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : hasFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        )}
      </div>

      {isError && <p className="type-error">{apiErrorMessage(error, 'Failed to load items. Please try again.')}</p>}
      {exportError && <p className="type-error">Failed to export CSV: {exportError}</p>}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[820px] text-left type-cell">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 py-3 type-th">SKU</th>
                <th className="px-4 py-3 type-th">Name</th>
                <th className="px-4 py-3 type-th">Tracking</th>
                <th className="px-4 py-3 text-right type-th">Purchasing Price</th>
                <th className="px-4 py-3 text-right type-th">Selling Price</th>
                <th className="px-4 py-3 type-th">Status</th>
                {canEdit && <th className="px-4 py-3 text-right type-th">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: canEdit ? 7 : 6 }, (_, j) => (
                      <td key={j} className="px-4 py-2.5"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    ))}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((it) => (
                  <tr key={it.id} className="group hover:bg-accent/10 transition-colors duration-150">
                    <td className="px-4 py-2.5">
                      <Link to={`/inventory/item/${it.id}`} className="whitespace-nowrap hover:text-accent-foreground transition-colors type-record-id">
                        {it.sku}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 truncate max-w-[220px] type-cell">{it.name}</td>
                    <td className="px-4 py-2.5 type-cell">
                      {it.tracking === TRACKING_SERIALIZED ? 'Serialized' : 'Quantity'}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-right type-cell">${itemPrice(it, 'purchasing').toFixed(2)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-right type-cell">${itemPrice(it, 'selling').toFixed(2)}</td>
                    <td className="px-4 py-2.5">
                      <span className={cn('inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 whitespace-nowrap type-pill', it.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-stone-100 text-ink-muted')}>
                        <span className={cn('size-1.5 shrink-0 rounded-full', it.isActive ? 'bg-emerald-500' : 'bg-stone-400')} aria-hidden="true" />
                        {it.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    {canEdit && (
                      <td className="px-4 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => navigate(`/inventory/item/${it.id}/edit`)}
                          aria-label={`Edit item ${it.name}`}
                          className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-ink-muted transition-colors hover:bg-accent hover:border-accent hover:text-accent-foreground cursor-pointer"
                        >
                          <Pencil className="size-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5 + (canEdit ? 1 : 0)} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-2xl bg-stone-100 p-4">
                        {hasFilters ? <Search className="size-6 text-ink-faint" /> : <Package className="size-6 text-ink-faint" />}
                      </div>
                      <p className="type-card-title">
                        {hasFilters ? 'No items match the current search.' : 'No inventory items added yet.'}
                      </p>
                      <p className="type-helper">{hasFilters ? 'Try adjusting your search or filters.' : 'Add your first item to get started.'}</p>
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

      {filtersOpen && <ItemFilterDrawer onClose={() => setFiltersOpen(false)} value={filters} onApply={applyFilters} />}
    </div>
  );
}
