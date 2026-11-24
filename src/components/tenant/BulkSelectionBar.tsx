import { Download, Loader2 } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
interface BulkSelectionBarProps {
  count: number;
  onExport: () => void;
  onClear: () => void;
  /** True while an export is in flight, so it cannot be started twice. */
  isExporting?: boolean;
}

/**
 * The bar a list shows while rows are ticked: how many, a way to download just
 * those rows as CSV, and a way to let go of them. Sticks to the bottom of the
 * scroll area so it stays reachable on a long page. Bulk delete, status change
 * and email are deliberately absent: they need backend bulk endpoints and audit.
 */
export function BulkSelectionBar({ count, onExport, onClear, isExporting = false }: BulkSelectionBarProps) {
  return (
    <div
      role="region"
      aria-label="Selected rows"
      className="sticky bottom-0 z-10 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 shadow-md"
    >
      <p role="status" className="text-xs font-semibold text-ink">{count} selected</p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onExport}
          disabled={isExporting}
          className={cn(buttonVariants({ variant: 'outline' }), 'flex')}
        >
          {isExporting ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}
          Export selected (CSV)
        </button>
        <button
          type="button"
          onClick={onClear}
          className={buttonVariants({ variant: 'ghost' })}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
