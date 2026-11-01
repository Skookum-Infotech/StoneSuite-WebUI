import { ChevronLeft, ChevronRight, ChevronsLeft } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { PAGE_SIZE_OPTIONS } from '@/lib/myTransactions';

const NAV_BTN =
  'flex h-9 items-center justify-center gap-1 rounded-lg border border-stone-200 bg-white px-3 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer sm:h-8';

/**
 * Keyset pager: the server gives no total or page numbers, only whether a next
 * page exists, so this offers First / Previous / Next and a rows-per-page
 * picker. Previous is disabled when the earlier cursors are unknown (a page
 * opened from a refreshed or shared URL); First page always works.
 */
export function VendorTransactionsPager({
  count, pageSize, can, go, onPageSize,
}: {
  count: number;
  pageSize: number;
  can: { first: boolean; prev: boolean; next: boolean };
  go: { first: () => void; prev: () => void; next: () => void };
  onPageSize: (size: number) => void;
}) {
  return (
    <nav
      aria-label="Pagination"
      className="flex flex-col gap-3 border-t border-stone-100 bg-stone-50/40 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 sm:justify-start">
        <p className="text-xs text-stone-500" aria-live="polite">
          Showing <span className="font-semibold text-stone-700">{count.toLocaleString()}</span> on this page
        </p>
        <label className="flex items-center gap-2 text-xs text-stone-500">
          <span>Rows per page</span>
          <Select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-8 rounded-lg border border-stone-200 bg-white px-2 text-xs font-semibold text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/40 cursor-pointer"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>{size}</option>
            ))}
          </Select>
        </label>
      </div>

      <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-end">
        <button type="button" onClick={go.first} disabled={!can.first} aria-label="First page" className={NAV_BTN}>
          <ChevronsLeft className="size-3.5" />
          <span className="hidden sm:inline">First</span>
        </button>
        <button type="button" onClick={go.prev} disabled={!can.prev} aria-label="Previous page" className={NAV_BTN}>
          <ChevronLeft className="size-3.5" />
          Previous
        </button>
        <button type="button" onClick={go.next} disabled={!can.next} aria-label="Next page" className={NAV_BTN}>
          Next
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </nav>
  );
}
