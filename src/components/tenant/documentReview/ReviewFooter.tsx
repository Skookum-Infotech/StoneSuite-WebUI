import * as React from 'react';
import { Loader2, Trash2 } from 'lucide-react';

interface ReviewFooterProps {
  /** Why Save is disabled ("2 required items to review"), or ''. */
  reason: string;
  isPending: boolean;
  onDiscard: () => void;
}

/** Fixed footer of review mode: Discard, the inline reason Save is disabled,
 *  and the submit button. Mirrors FormActionBar's placement and styling. */
export function ReviewFooter({ reason, isPending, onDiscard }: ReviewFooterProps): React.JSX.Element {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-end gap-3 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-6 py-3 shadow-sm lg:left-56 3xl:left-60 4xl:left-64">
      <p role="status" aria-live="polite" className="mr-auto text-xs font-medium text-warning dark:text-amber-400">{reason}</p>
      <button
        type="button"
        onClick={onDiscard}
        disabled={isPending}
        aria-label="Discard this document and its changes"
        className="inline-flex items-center gap-1.5 rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 px-3 py-1.5 text-xs font-medium text-stone-600 dark:text-stone-300 transition-all hover:border-stone-300 dark:hover:border-stone-600 hover:bg-stone-50 dark:hover:bg-white/10 disabled:opacity-50"
      >
        <Trash2 className="size-3" aria-hidden="true" />
        Discard
      </button>
      <button
        type="submit"
        disabled={isPending || reason !== ''}
        aria-label={reason ? `Save Order. Disabled: ${reason}` : 'Save Order'}
        className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-900 shadow-sm transition-all hover:bg-brand-hover active:scale-95 disabled:opacity-50"
      >
        {isPending && <Loader2 className="size-3 motion-safe:animate-spin" aria-hidden="true" />}
        {isPending ? 'Saving…' : 'Save Order'}
      </button>
    </div>
  );
}
