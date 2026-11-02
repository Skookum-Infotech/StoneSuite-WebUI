import { useCallback, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  useVendorTransactionsList,
  useVendorTransactionsSummary,
} from '@/hooks/useVendorTransactions';
import { EMPTY_FILTERS, isFiltered, parseFilters, writeFilters } from '@/lib/vendorTransactions';
import { DEFAULT_PAGE_SIZE } from '@/lib/myTransactions';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import type { VendorTransactionFilters as Filters } from '@/types/vendorTransactions';
import { VendorTransactionCards } from './VendorTransactionCards';
import { VendorTransactionFilters } from './VendorTransactionFilters';
import { VendorTransactionSummary } from './VendorTransactionSummary';
import { VendorTransactionsPager } from './VendorTransactionsPager';
import { VendorTransactionsTable } from './VendorTransactionsTable';

// Tailwind's lg breakpoint: the 7-column table needs this much width; below it
// the rows render as cards.
const WIDE_LAYOUT_QUERY = '(min-width: 1024px)';
const HTTP_NOT_FOUND = 404;
// A 404 means "no such vendor" and "not yours" alike, so the copy names neither.
const UNAVAILABLE_MESSAGE = 'Transactions are not available for this vendor.';
const NO_ACCESS_MESSAGE = "You don't have access to any transaction types for this vendor.";

const GHOST_BTN =
  'rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer';

function errorText(err: unknown): string {
  if (err instanceof AxiosError && err.response?.status === HTTP_NOT_FOUND) return UNAVAILABLE_MESSAGE;
  return apiErrorMessage(err, 'Failed to load transactions.');
}

/**
 * The vendor's Transactions tab: payables summary tiles plus a filterable,
 * paged list of every purchasing document the caller may see, newest first.
 * Filters and the current page's cursor live in the URL (next to the page's
 * own `tab` param), so they survive reload and sharing. The cursor is opaque
 * and only ever the one the server returned; the cursors of the pages already
 * visited are kept in memory so Previous works within a session.
 */
export function VendorTransactionsTab({ vendorId }: { vendorId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  // Cursors of the pages before this one ('' is the first page).
  const [visited, setVisited] = useState<string[]>([]);
  const isWide = useMediaQuery(WIDE_LAYOUT_QUERY);
  const listTopRef = useRef<HTMLDivElement>(null);

  const filters = parseFilters(searchParams);
  const update = useCallback(
    (patch: Partial<Filters>) => {
      setSearchParams((sp) => writeFilters(sp, patch), { replace: true });
      setVisited([]);
    },
    [setSearchParams],
  );

  const summary = useVendorTransactionsSummary(vendorId);
  const list = useVendorTransactionsList(vendorId, filters, pageSize);

  const rows = list.data?.rows ?? [];
  const nextCursor = list.data?.nextCursor ?? '';
  const overview = summary.data;

  const clear = () => update({ ...EMPTY_FILTERS });
  const refresh = () => {
    void list.refetch();
    void summary.refetch();
  };
  const moveTo = (cursor: string) => {
    setSearchParams((sp) => writeFilters(sp, { cursor }), { replace: true });
    listTopRef.current?.scrollIntoView?.({ block: 'start' });
  };
  const goNext = () => {
    if (!nextCursor) return;
    setVisited((v) => [...v, filters.cursor]);
    moveTo(nextCursor);
  };
  const goPrev = () => {
    const previous = visited[visited.length - 1];
    if (previous === undefined) return;
    setVisited((v) => v.slice(0, -1));
    moveTo(previous);
  };
  const goFirst = () => {
    setVisited([]);
    moveTo('');
  };
  const changePageSize = (size: number) => {
    setPageSize(size);
    setVisited([]);
    moveTo('');
  };

  if (overview && overview.types.length === 0) {
    return <p role="status" className="px-1 py-8 text-center text-xs font-semibold text-stone-500">{NO_ACCESS_MESSAGE}</p>;
  }

  const failure = (summary.isError && !overview ? summary.error : null) ?? (list.isError && !list.data ? list.error : null);

  return (
    <div className="flex flex-col gap-4">
      {overview && <VendorTransactionSummary summary={overview.summary} scopeLimited={overview.scopeLimited} />}

      <div ref={listTopRef} className="scroll-mt-3 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        {overview && (
          <VendorTransactionFilters filters={filters} overview={overview} onChange={update} onClear={clear} />
        )}

        {failure ? (
          <div className="space-y-3 p-4 sm:p-6">
            <ErrorNote>{errorText(failure)}</ErrorNote>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={refresh} className={GHOST_BTN}>Try again</button>
              {filters.cursor !== '' && (
                <button type="button" onClick={goFirst} className={GHOST_BTN}>Back to first page</button>
              )}
            </div>
          </div>
        ) : list.isLoading || !overview ? (
          <div className="px-4"><Spinner label="Loading transactions…" /></div>
        ) : rows.length === 0 && filters.cursor === '' ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center sm:py-16">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100">
              <Search className="size-5 text-stone-400" />
            </div>
            {isFiltered(filters) ? (
              <>
                <p className="text-xs font-semibold text-stone-500">No matching transactions</p>
                <p className="text-xs text-stone-500">Try adjusting your search or filters</p>
                <button type="button" onClick={clear} className={cn(GHOST_BTN, 'mt-2')}>Clear filters</button>
              </>
            ) : (
              <p className="text-xs font-semibold text-stone-500">No transactions for this vendor yet</p>
            )}
          </div>
        ) : (
          <>
            <div className={cn('transition-opacity', list.isPlaceholderData && 'opacity-60')}>
              {rows.length === 0 ? (
                <p className="px-4 py-10 text-center text-xs text-stone-500">No more transactions.</p>
              ) : isWide ? (
                <VendorTransactionsTable rows={rows} />
              ) : (
                <VendorTransactionCards rows={rows} />
              )}
            </div>
            <VendorTransactionsPager
              count={rows.length}
              pageSize={pageSize}
              can={{ first: filters.cursor !== '', prev: visited.length > 0, next: nextCursor !== '' }}
              go={{ first: goFirst, prev: goPrev, next: goNext }}
              onPageSize={changePageSize}
            />
          </>
        )}
      </div>
    </div>
  );
}
