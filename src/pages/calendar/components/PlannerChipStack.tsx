import { useState } from 'react';
import { cardNoun, visibleCardCount } from '@/lib/plannerCards';
import type { PlannerCard } from '@/lib/plannerCards';
import { PlannerChip } from './PlannerChip';

/** One cell's chips, stacked. Past `max` the tail folds behind "N more" — which
 *  takes the last of the `max` slots, so a single hidden chip is never folded —
 *  and the toggle opens it in place. */
export function PlannerChipStack({ cards, columnLabel, max }: {
  cards: readonly PlannerCard[];
  /** Names the cell in the toggle's accessible name: "Tue, Oct 12, 9 AM". */
  columnLabel: string;
  max: number;
}) {
  const [expanded, setExpanded] = useState(false);
  if (cards.length === 0) return null;

  const shown = visibleCardCount(cards.length, max, expanded);
  const hidden = cards.length - shown;
  const folds = cards.length > max;
  const noun = cardNoun(cards[0].kind, hidden);

  return (
    <div className="flex flex-col gap-0.5">
      {cards.slice(0, shown).map((card) => (
        <PlannerChip key={card.id} card={card} />
      ))}
      {folds && (
        <button
          type="button"
          aria-expanded={expanded}
          aria-label={expanded ? `Show fewer ${noun} for ${columnLabel}` : `Show ${hidden} more ${noun} for ${columnLabel}`}
          onClick={() => setExpanded((open) => !open)}
          className="w-full rounded-md px-1.5 py-0.5 text-left text-xs font-semibold text-stone-600 outline-none transition-colors hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? 'Show fewer' : `${hidden} more`}
        </button>
      )}
    </div>
  );
}
