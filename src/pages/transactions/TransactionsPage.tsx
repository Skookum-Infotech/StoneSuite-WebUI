import { useRef, useState } from 'react';
import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { CreditCard, RefreshCw, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { DEFAULT_PAGE_SIZE, pageCount } from '@/lib/myTransactions';
import { myTransactionsService } from '@/services/myTransactionsService';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import type { TransactionRoleFilter } from '@/types/myTransactions';
import { TransactionCards } from './components/TransactionCards';
import { TransactionFilters } from './components/TransactionFilters';
import { TransactionStats } from './components/TransactionStats';
import { TransactionsPagination } from './components/TransactionsPagination';
import { TransactionsTable } from './components/TransactionsTable';

const SEARCH_DEBOUNCE_MS = 300;
// Fresher than the app-wide default: the list should reflect the record the
// user just created or edited, not a copy from two minutes ago.
const STALE_MS = 10_000;
// Tailwind's lg breakpoint: the 7-column table needs this much width; below it
// the records render as cards (see TransactionCards).
const WIDE_LAYOUT_QUERY = '(min-width: 1024px)';

/**
 * My Transactions: the records the signed-in user created, or last updated on
 * someone else's behalf, across every module they may read. The backend does
 * all filtering, RBAC and paging (see services/myTransactionsService).
 */
export default function TransactionsPage() {
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<TransactionRoleFilter>('all');
  const [type, setType] = useState('');
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const debouncedSearch = useDebouncedValue(search.trim(), SEARCH_DEBOUNCE_MS);
  const isWide = useMediaQuery(WIDE_LAYOUT_QUERY);
  const listTopRef = useRef<HTMLDivElement>(null);

  // The page belongs to one filter combination: changing any filter or the page
  // size starts again from page 1 (React's "adjust state while rendering"
  // pattern — no effect, so there is no render with a stale page).
  const filterKey = `${role}|${type}|${debouncedSearch}|${pageSize}`;
  const [paging, setPaging] = useState({ key: filterKey, page: 1 });
  if (paging.key !== filterKey) setPaging({ key: filterKey, page: 1 });
  const page = paging.key === filterKey ? paging.page : 1;

  const list = useQuery({
    queryKey: ['my-transactions', 'list', role, type, debouncedSearch, page, pageSize],
    queryFn: () =>
      myTransactionsService.list({ role, type, q: debouncedSearch, page, limit: pageSize }),
    // Keep the old rows on screen while the next page or filter loads.
    placeholderData: keepPreviousData,
    staleTime: STALE_MS,
  });
  // Stat cards and the type filter are independent of the filters and page, so
  // they load once rather than on every page turn.
  const overview = useQuery({
    queryKey: ['my-transactions', 'overview'],
    queryFn: myTransactionsService.overview,
    staleTime: STALE_MS,
  });

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const lastPage = pageCount(total, pageSize);
  const isFiltered = role !== 'all' || type !== '' || search.trim() !== '';
  const isRefreshing = list.isFetching || overview.isFetching;

  // The list shrank under the user (records deleted elsewhere): step back to the
  // last real page. The backend reports the true total even for an empty page.
  if (list.data && !list.isPlaceholderData && page > lastPage) {
    setPaging({ key: filterKey, page: lastPage });
  }

  const goToPage = (next: number) => {
    setPaging({ key: filterKey, page: Math.min(Math.max(1, next), lastPage) });
    // A long page on a phone leaves the user at the bottom: bring the list back
    // into view. Instant (not smooth) so it is deterministic and motion-free.
    listTopRef.current?.scrollIntoView?.({ block: 'start' });
  };

  const clearFilters = () => {
    setSearch('');
    setRole('all');
    setType('');
  };

  const refresh = () => {
    void list.refetch();
    void overview.refetch();
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="p-3 sm:p-6 3xl:p-10 4xl:p-14 flex flex-col gap-4 sm:gap-5">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/20 text-brand-dark">
              <CreditCard className="size-4.5" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-bold tracking-tight text-stone-900">My Transactions</h1>
              <p className="mt-0.5 text-xs text-stone-500">Records you created or last updated</p>
            </div>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={isRefreshing}
            aria-label="Refresh"
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-xl border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-600 shadow-sm transition-colors hover:bg-stone-50 disabled:opacity-60 cursor-pointer sm:px-3.5"
          >
            <RefreshCw className={cn('size-3.5', isRefreshing && 'animate-spin')} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>

        <TransactionStats summary={overview.data?.summary ?? null} />

        {/* ── List card ── */}
        <div ref={listTopRef} className="scroll-mt-3 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
          <TransactionFilters
            search={search}
            onSearch={setSearch}
            role={role}
            onRole={setRole}
            types={overview.data?.types ?? []}
            type={type}
            onType={setType}
          />

          {list.isLoading ? (
            <div className="px-4"><Spinner label="Loading your transactions…" /></div>
          ) : list.isError && !list.data ? (
            <div className="space-y-3 p-4 sm:p-6">
              <ErrorNote>{apiErrorMessage(list.error, 'Failed to load your transactions.')}</ErrorNote>
              <button
                type="button"
                onClick={refresh}
                className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
              >
                Try again
              </button>
            </div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-12 text-center sm:py-16">
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100">
                  <Search className="size-5 text-stone-300" />
                </div>
                {isFiltered ? (
                  <>
                    <p className="text-xs font-semibold text-stone-500">No matching records</p>
                    <p className="text-xs text-stone-400">Try adjusting your search or filters</p>
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="mt-2 rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer"
                    >
                      Clear filters
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-xs font-semibold text-stone-500">No activity yet</p>
                    <p className="text-xs text-stone-400">Records you create or update will appear here</p>
                  </>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className={cn('transition-opacity', list.isPlaceholderData && 'opacity-60')}>
                {isWide ? <TransactionsTable rows={rows} /> : <TransactionCards rows={rows} />}
              </div>
              <TransactionsPagination
                page={page}
                pageSize={pageSize}
                total={total}
                onPage={goToPage}
                onPageSize={setPageSize}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
