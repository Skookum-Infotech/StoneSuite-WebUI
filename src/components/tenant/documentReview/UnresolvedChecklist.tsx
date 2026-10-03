import * as React from 'react';
import { cn } from '@/lib/utils';
import type { ReviewItem } from '@/lib/salesOrderDocumentHandoff';

interface UnresolvedChecklistProps {
  pending: ReviewItem[];
  onJump: (key: string) => void;
}

/** "5 to review (4 required)" — the same total the header's "Needs review (n)"
 *  shows, with the part that blocks Save called out. */
function checklistTitle(pending: ReviewItem[]): string {
  if (pending.length === 0) return 'Nothing left to review';
  const required = pending.filter((i) => i.required).length;
  return required > 0 ? `${pending.length} to review (${required} required)` : `${pending.length} optional ${pending.length === 1 ? 'check' : 'checks'} left`;
}

/** Inline list of everything still unresolved; each entry jumps to its field.
 *  The reason Save is disabled is announced by ReviewFooter's live region (the
 *  single one), so this list stays silent. */
export function UnresolvedChecklist({ pending, onJump }: UnresolvedChecklistProps): React.JSX.Element {
  return (
    <section aria-label="Items to review" className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-3 text-xs">
      <p className="font-semibold text-stone-900 dark:text-stone-100">
        {checklistTitle(pending)}
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
