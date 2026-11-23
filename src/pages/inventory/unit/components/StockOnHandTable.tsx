import { Fragment, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronDown, ChevronLeft, ChevronRight, Package, Search } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryService } from '@/services/inventoryService';
import { useStockTotals } from '@/hooks/useStockTotals';
import { formatStockQty } from '@/lib/stockFormat';
import { unitLabel } from '@/lib/unitLabels';
import { TRACKING_QUANTITY, type InventoryItemSearchRequest } from '@/types/inventory';
import { ItemStockTab } from './ItemStockTab';

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;
const COLUMN_COUNT = 7;

// Slabs are counted one by one under All Units. Everything else the shop keeps
// track of — adhesive, sinks, blades — is a count per location, listed here. A
// service or labour line is never counted, so the server leaves it out.
const COUNTED_ITEMS_FILTERS: InventoryItemSearchRequest['filters'] = [
  { field: 'tracking', op: 'eq', value: TRACKING_QUANTITY },
  { field: 'track_stock', op: 'eq', value: true },
];

const HEADERS = [
  { label: 'SKU', right: false },
  { label: 'Item', right: false },
  { label: 'On hand', right: true },
  { label: 'Allocated', right: true },
  { label: 'Available', right: true },
  { label: 'Status', right: false },
] as const;

export function StockOnHandTable() {
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);
  const [open, setOpen] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(term.trim());
      setCursor('');
      setPrevCursors([]);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  const req: InventoryItemSearchRequest = {
    search: debounced || undefined,
    filters: COUNTED_ITEMS_FILTERS,
    sort: [{ field: 'name', dir: 'asc' }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };
  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['inventory-stock-items', req],
    queryFn: () => inventoryService.searchItems(req),
    placeholderData: (prev) => prev,
  });
  const records = data?.records ?? [];
  const { data: totals, isLoading: totalsLoading } = useStockTotals(records.map((r) => r.id));

  function toggle(id: string) {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function goNext() {
    if (!data?.nextCursor) return;
    setPrevCursors((p) => [...p, cursor]);
    setCursor(data.nextCursor);
  }
  function goPrev() {
    setCursor(prevCursors[prevCursors.length - 1] ?? '');
    setPrevCursors((p) => p.slice(0, -1));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative max-w-sm">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" aria-hidden="true" />
        <input
          type="search"
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Search by name or SKU"
          aria-label="Search stock"
          className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-xs text-stone-800 outline-none focus:border-stone-400 focus:ring-1 focus:ring-stone-900/5"
        />
      </div>

      {isError && <p className="text-xs text-red-500">{apiErrorMessage(error, 'Failed to load stock. Please try again.')}</p>}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="w-10 px-3 py-3"><span className="sr-only">Show by location</span></th>
                {HEADERS.map((h) => (
                  <th key={h.label} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 ${h.right ? 'text-right' : ''}`}>
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading && Array.from({ length: 5 }, (_, i) => (
                <tr key={i}>
                  {Array.from({ length: COLUMN_COUNT }, (_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-3 w-16 animate-pulse rounded bg-stone-100" /></td>
                  ))}
                </tr>
              ))}
              {!isLoading && records.map((it) => {
                const total = totals?.[it.id];
                const expanded = open.has(it.id);
                const unit = unitLabel(total?.unitCode);
                return (
                  <Fragment key={it.id}>
                    <tr className="hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-3 py-3.5">
                        <button
                          type="button"
                          onClick={() => toggle(it.id)}
                          aria-expanded={expanded}
                          aria-label={`${expanded ? 'Hide' : 'Show'} stock by location for ${it.name}`}
                          className="rounded p-0.5 text-stone-500 hover:bg-stone-100 hover:text-stone-700"
                        >
                          {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 font-mono text-xs font-semibold whitespace-nowrap text-stone-900">{it.sku}</td>
                      <td className="max-w-[240px] truncate px-4 py-3.5 text-stone-700">{it.name}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-stone-800">
                        {total ? <>{formatStockQty(total.onHand)}{unit && <span className="ml-1 text-stone-400">{unit}</span>}</> : totalsLoading ? '…' : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-right tabular-nums text-stone-500">{total ? formatStockQty(total.allocated) : '—'}</td>
                      <td className="px-4 py-3.5 text-right tabular-nums font-semibold text-stone-800">{total ? formatStockQty(total.available) : '—'}</td>
                      <td className="px-4 py-3.5">
                        {total?.belowReorder && (
                          <span className="rounded-md bg-amber-50 px-2 py-0.5 text-2xs font-semibold text-amber-700">Low stock</span>
                        )}
                      </td>
                    </tr>
                    {expanded && (
                      <tr>
                        <td colSpan={COLUMN_COUNT} className="bg-stone-50/60 px-4 py-4"><ItemStockTab item={it} /></td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
              {!isLoading && records.length === 0 && (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-2xl bg-stone-100 p-4"><Package className="size-6 text-stone-400" /></div>
                      <p className="text-sm font-semibold text-stone-700">{debounced ? 'No items match that search.' : 'No counted items yet.'}</p>
                      <p className="text-xs text-stone-500">
                        {debounced ? 'Try a different name or SKU.' : 'Items you count by quantity — adhesive, sinks, blades — appear here once received.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {records.length > 0 && (
          <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/40 px-4 py-3">
            <p className="text-xs tabular-nums text-stone-500">Page {prevCursors.length + 1}{data?.hasMore ? '' : ' · last page'}</p>
            <div className="flex items-center gap-1.5">
              <button onClick={goPrev} disabled={prevCursors.length === 0} aria-label="Previous page"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronLeft className="size-3.5" /> Previous
              </button>
              <button onClick={goNext} disabled={!data?.hasMore} aria-label="Next page"
                className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40">
                Next <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
