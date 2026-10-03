import * as React from 'react';
import { Check, TriangleAlert } from 'lucide-react';
import { reconcileTotals } from '@/lib/documentReviewState';
import type { HandoffLine } from '@/lib/salesOrderDocumentHandoff';

interface TotalsReconcileCardProps {
  /** Document total before tax, in dollars; null when the document had none. */
  docTotal: number | null;
  /** Live form total before tax, in dollars. */
  formTotal: number;
  lines: HandoffLine[];
  formAmounts: Map<string, number>;
}

function usd(n: number): string {
  return `$${Math.abs(n).toFixed(2)}`;
}

/** Document total vs the live form total, recomputed as the form is edited:
 *  a check mark when they agree, otherwise "Off by $X - check line N". */
export function TotalsReconcileCard({ docTotal, formTotal, lines, formAmounts }: TotalsReconcileCardProps): React.JSX.Element {
  const rec = docTotal === null ? null : reconcileTotals(docTotal, formTotal, lines, formAmounts);
  return (
    <div className="rounded-lg border border-stone-200 dark:border-stone-800 bg-white dark:bg-stone-900 p-3 text-xs">
      <p className="font-semibold text-stone-900 dark:text-stone-100">Totals check (before tax)</p>
      <dl className="mt-1 grid grid-cols-2 gap-x-3 text-stone-600 dark:text-stone-300">
        <dt>Document total</dt>
        <dd className="text-right tabular-nums">{docTotal === null ? 'Not found' : usd(docTotal)}</dd>
        <dt>Form total</dt>
        <dd className="text-right tabular-nums">{usd(formTotal)}</dd>
      </dl>
      <div role="status" aria-live="polite">
      {rec && rec.ok && (
        <p className="mt-2 inline-flex items-center gap-1 font-semibold text-accent-foreground">
          <Check className="size-3.5" aria-hidden="true" />
          Matches the document
        </p>
      )}
      {rec && !rec.ok && (
        <p className="mt-2 inline-flex items-center gap-1 font-semibold text-warning dark:text-amber-400">
          <TriangleAlert className="size-3.5" aria-hidden="true" />
          Off by {usd(rec.diff)}{rec.suspectLine ? ` — check line ${rec.suspectLine}` : ''}
        </p>
      )}
      {!rec && <p className="mt-2 text-stone-500 dark:text-stone-400">The document total couldn't be read, so it can't be checked.</p>}
      </div>
    </div>
  );
}
