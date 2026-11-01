import { useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AxiosError } from 'axios';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  useCustomerTransactionsList,
  useCustomerTransactionsSummary,
} from '@/hooks/useCustomerTransactions';
import { EMPTY_FILTERS, isFiltered, parseFilters, writeFilters } from '@/lib/customerTransactions';
import { DEFAULT_PAGE_SIZE, pageCount } from '@/lib/myTransactions';
import { ErrorNote, Spinner } from '@/components/tenant/ui';
import { TransactionsPagination } from '@/pages/transactions/components/TransactionsPagination';
import type { CustomerTransactionFilters as Filters } from '@/types/customerTransactions';
import { CustomerTransactionCards } from './CustomerTransactionCards';
import { CustomerTransactionFilters } from './CustomerTransactionFilters';
import { CustomerTransactionSummary } from './CustomerTransactionSummary';
import { CustomerTransactionsTable } from './CustomerTransactionsTable';

// Tailwind's lg breakpoint: the 7-column table needs this much width; below it
// the rows render as cards.
const WIDE_LAYOUT_QUERY = '(min-width: 1024px)';
const HTTP_NOT_FOUND = 404;
// A 404 means "no such customer" and "not yours" alike, so the copy names neither.
const UNAVAILABLE_MESSAGE = 'Transactions are not available for this customer.';
const NO_ACCESS_MESSAGE = "You don't have access to any transaction types for this customer.";

const GHOST_BTN =
  'rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-xs font-semibold text-stone-600 hover:bg-stone-50 cursor-pointer';

function errorText(err: unknown): string {
  if (err instanceof AxiosError && err.response?.status === HTTP_NOT_FOUND) return UNAVAILABLE_MESSAGE;
  return apiErrorMessage(err, 'Failed to load transactions.');
}

/**
 * The customer's Transactions tab: AR summary tiles plus a filterable, paged
 * list of every transaction the caller may see. Filters and page live in the
 * URL (next to the page's own `tab` param), so they survive reload and sharing.
 */
export function CustomerTransactionsTab({ customerId }: { customerId: string }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const isWide = useMediaQuery(WIDE_LAYOUT_QUERY);
  const listTopRef = useRef<HTMLDivElement>(null);

  const filters = parseFilters(searchParams);
  const update = useCallback(
    (patch: Partial<Filters>) => setSearchParams((sp) => writeFilters(sp, patch), { replace: true }),
    [setSearchParams],
  );

  const summary = useCustomerTransactionsSummary(customerId);
  const list = useCustomerTransactionsList(customerId, filters, pageSize);

  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const lastPage = pageCount(total, pageSize);
  const overview = summary.data;

  // The list shrank under the user: step back to the last real page.
  const stalePage = Boolean(list.data) && !list.isPlaceholderData && filters.page > lastPage;
  useEffect(() => {
    if (stalePage) update({ page: lastPage });
  }, [stalePage, lastPage, update]);

  const clear = () => setSearchParams((sp) => writeFilters(sp, {
    ...EMPTY_FILTERS, page: 1,
  }), { replace: true });
  const refresh = () => {
    void list.refetch();
    void summary.refetch();
  };
  const goToPage = (next: number) => {
    update({ page: Math.min(Math.max(1, next), lastPage) });
    listTopRef.current?.scrollIntoView?.({ block: 'start' });
  };
  const changePageSize = (size: number) => {
    setPageSize(size);
    update({ page: 1 });
  };

  if (overview && overview.types.length === 0) {
    return <p role="status" className="px-1 py-8 text-center text-xs font-semibold text-stone-500">{NO_ACCESS_MESSAGE}</p>;
  }

  const failure = (summary.isError && !overview ? summary.error : null) ?? (list.isError && !list.data ? list.error : null);

  return (
    <div className="flex flex-col gap-4">
      {overview && <CustomerTransactionSummary summary={overview.summary} scopeLimited={overview.scopeLimited} />}

      <div ref={listTopRef} className="scroll-mt-3 overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-sm">
        {overview && (
          <CustomerTransactionFilters filters={filters} overview={overview} onChange={update} onClear={clear} />
        )}

        {failure ? (
          <div className="space-y-3 p-4 sm:p-6">
            <ErrorNote>{errorText(failure)}</ErrorNote>
            <button type="button" onClick={refresh} className={GHOST_BTN}>Try again</button>
          </div>
        ) : list.isLoading || !overview ? (
          <div className="px-4"><Spinner label="Loading transactions…" /></div>
        ) : rows.length === 0 ? (
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
              <p className="text-xs font-semibold text-stone-500">No transactions for this customer yet</p>
            )}
          </div>
        ) : (
          <>
            <div className={cn('transition-opacity', list.isPlaceholderData && 'opacity-60')}>
              {isWide ? <CustomerTransactionsTable rows={rows} /> : <CustomerTransactionCards rows={rows} />}
            </div>
            <TransactionsPagination
              page={filters.page}
              pageSize={pageSize}
              total={total}
              onPage={goToPage}
              onPageSize={changePageSize}
            />
          </>
        )}
      </div>
    </div>
  );
}
