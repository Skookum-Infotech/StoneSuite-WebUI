import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  pageNum: number;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
}

// Next/Prev only — the server's keyset cursor has no notion of "page N", so
// there is no jump-to-page control here by design.
export function AuditPagination({ pageNum, hasNext, hasPrev, onNext, onPrev }: Props) {
  return (
    <div className="flex items-center justify-between px-1">
      <p className="text-xs text-stone-500 tabular-nums">
        Page {pageNum}
        {hasNext ? '' : ' · last page'}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Previous page"
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="size-3.5" />
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Next page"
          className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Next
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
