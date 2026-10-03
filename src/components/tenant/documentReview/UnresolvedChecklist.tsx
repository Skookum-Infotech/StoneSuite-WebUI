import * as React from 'react';
import { cn } from '@/lib/utils';
import type { ReviewItem } from '@/lib/salesOrderDocumentHandoff';

interface UnresolvedChecklistProps {
  pending: ReviewItem[];
  /** Why Save is disabled ("2 items need review"), or '' when it isn't. */
  blockedReason: string;
  onJump: (key: string) => void;
}

/** Inline list of everything still unresolved; each entry jumps to its field.
 *  The reason Save is disabled is announced by ReviewFooter's live region (the
 *  single one), so this list stays silent. */
export function UnresolvedChecklist({ pending, blockedReason, onJump }: UnresolvedChecklistProps): React.JSX.Element {
  return (
    <section aria-label="Items to review" className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-3 text-xs">
      <p className="font-semibold text-stone-900 dark:text-stone-100">
        {pending.length === 0 ? 'Nothing left to review' : blockedReason || `${pending.length} optional checks left`}
      </p>
      {pending.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {pending.map((item) => (
            <li key={item.key} className="flex items-start gap-2">
              <span className={cn('mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-2xs font-semibold', item.required ? 'bg-warning/10 dark:bg-amber-500/10 text-warning dark:text-amber-400' : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300')}>
                {item.required ? 'Required' : 'Check'}
              </span>
              <button
                type="button"
                onClick={() => onJump(item.key)}
                className="text-left text-stone-700 dark:text-stone-300 underline-offset-2 hover:underline"
              >
                <span className="font-medium">{item.label}</span> {'—'} {item.reason}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
