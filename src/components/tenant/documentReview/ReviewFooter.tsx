import * as React from 'react';
import { Loader2, Trash2 } from 'lucide-react';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
interface ReviewFooterProps {
  /** Why Save is disabled ("2 required items to review"), or ''. */
  reason: string;
  isPending: boolean;
  onDiscard: () => void;
  /** The submit button's label; "Save Order" unless the page saves something else. */
  saveLabel?: string;
}

/** Fixed footer of review mode: Discard, the inline reason Save is disabled,
 *  and the submit button. Mirrors FormActionBar's placement and styling. */
export function ReviewFooter({ reason, isPending, onDiscard, saveLabel = 'Save Order' }: ReviewFooterProps): React.JSX.Element {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-20 flex items-center justify-end gap-3 border-t border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 px-6 py-3 shadow-sm lg:left-56 3xl:left-60 4xl:left-64">
      <p role="status" aria-live="polite" className="mr-auto text-xs font-medium text-warning-ink dark:text-amber-400">{reason}</p>
      <button
        type="button"
        onClick={onDiscard}
        disabled={isPending}
        aria-label="Discard this document and its changes"
        className={cn(buttonVariants({ variant: 'outline' }), 'dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300 dark:hover:border-stone-600 dark:hover:bg-white/10')}
      >
        <Trash2 className="size-3" aria-hidden="true" />
        Discard
      </button>
      <button
        type="submit"
        disabled={isPending || reason !== ''}
        aria-label={isPending ? undefined : reason ? `${saveLabel}. Disabled: ${reason}` : saveLabel}
        className={cn(buttonVariants(), 'active:scale-95')}
      >
        {isPending && <Loader2 className="size-3 motion-safe:animate-spin" aria-hidden="true" />}
        {isPending ? 'Saving…' : saveLabel}
      </button>
    </div>
  );
}
