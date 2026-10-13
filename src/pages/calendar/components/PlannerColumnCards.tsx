import { useState } from 'react';
import { cardNoun } from '@/lib/plannerCards';
import type { PlannerCard } from '@/lib/plannerCards';
import { PlannerEventCard } from './PlannerEventCard';

/** The most cards a column shows at once. A busier column folds the rest behind
 *  "Show N more", and that button takes the last of these slots — so a column is
 *  never folded just to hide a single card. */
export const MAX_COLUMN_CARDS = 5;

const STACK_CLS = 'flex flex-col gap-1.5';
const TOGGLE_CLS =
  'w-full rounded-md border border-dashed border-stone-300 bg-white px-2 py-1.5 text-xs font-semibold text-stone-600 transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50';

/** One column's job cards, stacked. Past MAX_COLUMN_CARDS the tail is folded away
 *  so a single busy day can't push the rest of the page out of reach; the toggle
 *  opens it in place. `className` lays the cards out (a stack by default). */
export function PlannerColumnCards({ cards, columnLabel, className = STACK_CLS }: {
  cards: readonly PlannerCard[];
  /** Names the column in the toggle's accessible name: "Tue, Oct 12". */
  columnLabel: string;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  if (cards.length === 0) return null;

  const folds = cards.length > MAX_COLUMN_CARDS;
  const visible = folds && !expanded ? cards.slice(0, MAX_COLUMN_CARDS - 1) : cards;
  const hidden = cards.length - visible.length;
  const noun = cardNoun(cards[0].kind, hidden);

  return (
    <div className="flex flex-col gap-1.5">
      <div className={className}>
        {visible.map((card) => (
          <PlannerEventCard key={card.id} card={card} />
        ))}
      </div>
      {folds && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? `Show fewer ${noun} for ${columnLabel}` : `Show ${hidden} more ${noun} for ${columnLabel}`}
          onClick={() => setExpanded((open) => !open)}
          className={TOGGLE_CLS}
        >
          {expanded ? 'Show fewer' : `Show ${hidden} more`}
        </button>
      )}
    </div>
  );
}
