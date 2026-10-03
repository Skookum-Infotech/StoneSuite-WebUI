import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { PAGE_SIZE_OPTIONS, buildPageItems, pageCount, pageRange } from '@/lib/myTransactions';

// 36px touch targets on phones, the denser 32px from sm up.
const NAV_BTN =
  'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-500 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer sm:h-8 sm:w-8';

/**
 * Numbered pagination for the My Transactions list: "Showing 26–50 of 132", a
 * rows-per-page picker and first/prev/page-numbers/next/last. On phones the
 * number strip collapses to "Page 3 of 7" between large Previous/Next buttons
 * and first/last are dropped, so the bar never needs horizontal scrolling.
 */
export function TransactionsPagination({
  page, pageSize, total, onPage, onPageSize,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}) {
  const count = pageCount(total, pageSize);
  const { from, to } = pageRange(page, pageSize, total);
  const items = buildPageItems(page, count);
  const atStart = page <= 1;
  const atEnd = page >= count;

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 border-t border-stone-100 bg-stone-50/40 px-3 py-3 sm:px-4 lg:flex-row lg:items-center lg:justify-between"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 lg:justify-start">
        <p className="text-xs text-stone-500" aria-live="polite">
          Showing{' '}
          <span className="font-semibold text-stone-700">{from.toLocaleString()}–{to.toLocaleString()}</span>
          {' '}of <span className="font-semibold text-stone-700">{total.toLocaleString()}</span>
        </p>
        <label className="flex items-center gap-2 text-xs text-stone-500">
          <span>Rows per page</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/40 cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-center">
        <button
          type="button"
          onClick={() => onPage(1)}
          disabled={atStart}
          aria-label="First page"
          className={cn(NAV_BTN, 'hidden sm:flex')}
        >
          <ChevronsLeft className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onPage(page - 1)}
          disabled={atStart}
          aria-label="Previous page"
          className={NAV_BTN}
        >
          <ChevronLeft className="size-3.5" />
        </button>

        <ol className="hidden items-center gap-1 sm:flex">
          {items.map((item) =>
            typeof item === 'number' ? (
              <li key={item}>
                <button
                  type="button"
                  onClick={() => onPage(item)}
                  aria-label={`Page ${item}`}
                  aria-current={item === page ? 'page' : undefined}
                  className={cn(
                    'flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-xs font-semibold transition-colors cursor-pointer',
                    item === page
                      ? 'bg-[#001219] text-white shadow-sm'
                      : 'border border-stone-200 bg-white text-stone-600 hover:bg-stone-50',
                  )}
                >
                  {item}
                </button>
              </li>
            ) : (
              <li key={item} aria-hidden="true" className="flex h-8 w-6 items-center justify-center text-stone-400">…</li>
            ),
          )}
        </ol>
        <span className="px-2 text-xs font-semibold text-stone-600 sm:hidden">
          Page {page} of {count}
        </span>

        <button
          type="button"
          onClick={() => onPage(page + 1)}
          disabled={atEnd}
          aria-label="Next page"
          className={NAV_BTN}
        >
          <ChevronRight className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onPage(count)}
          disabled={atEnd}
          aria-label="Last page"
          className={cn(NAV_BTN, 'hidden sm:flex')}
        >
          <ChevronsRight className="size-3.5" />
        </button>
      </div>
    </nav>
  );
}
