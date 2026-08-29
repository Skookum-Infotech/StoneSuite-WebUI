import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Props {
  pageNum: number;
  hasNext: boolean;
  hasPrev: boolean;
  onNext: () => void;
  onPrev: () => void;
}

// Next/Prev only — the server's keyset cursor has no notion of "page N"
// (mirrors AuditPagination's rationale for the audit log browser).
export function FeedbackPagination({ pageNum, hasNext, hasPrev, onNext, onPrev }: Props) {
  return (
    <div className="flex items-center justify-between px-1">
      <p className="text-xs tabular-nums text-stone-500">
        Page {pageNum}
        {hasNext ? '' : ' · last page'}
      </p>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onPrev}
          disabled={!hasPrev}
          aria-label="Previous page"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-stone-300 dark:hover:bg-white/[0.06]"
        >
          <ChevronLeft className="size-3.5" />
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={!hasNext}
          aria-label="Next page"
          className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:bg-transparent dark:text-stone-300 dark:hover:bg-white/[0.06]"
        >
          Next
          <ChevronRight className="size-3.5" />
        </button>
      </div>
    </div>
  );
}
