import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { SlabPage } from '@/lib/itemReceiptSlabs';

const pagerButtonCls =
  'inline-flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-2xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40';

// Previous / Next under a table of a long delivery. Nothing is drawn while
// everything fits on one page.
export function SlabPager({ noun, page, onPage }: {
  noun: 'groups' | 'slabs';
  page: SlabPage<unknown>;
  onPage: (next: number) => void;
}) {
  if (page.pageCount <= 1) return null;
  const heading = noun === 'groups' ? 'Groups' : 'Slabs';
  const first = page.offset + 1;
  const last = page.offset + page.items.length;

  return (
    <div className="mt-1.5 flex items-center justify-between">
      <p className="text-2xs tabular-nums text-stone-500" aria-live="polite">{heading} {first}–{last} of {page.total}</p>
      <div className="flex items-center gap-1.5">
        <button
          type="button" onClick={() => onPage(page.page - 1)} disabled={page.page <= 1}
          aria-label={`Previous page of ${noun}`} className={pagerButtonCls}
        >
          <ChevronLeft className="size-3" aria-hidden="true" /> Previous
        </button>
        <button
          type="button" onClick={() => onPage(page.page + 1)} disabled={page.page >= page.pageCount}
          aria-label={`Next page of ${noun}`} className={pagerButtonCls}
        >
          Next <ChevronRight className="size-3" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
