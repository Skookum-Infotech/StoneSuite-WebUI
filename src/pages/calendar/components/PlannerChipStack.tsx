import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { countLabel, visibleCardCount } from '@/lib/plannerCards';
import type { PlannerCard } from '@/lib/plannerCards';
import { PlannerChip } from './PlannerChip';

// A narrow column stacks its chips; the Day view's one wide column wraps them
// into as many columns of at least 14rem as fit.
const STACK_CLS = 'flex flex-col gap-0.5';
const WRAP_CLS = 'grid grid-cols-[repeat(auto-fill,minmax(14rem,1fr))] gap-0.5';
const MORE_CLS =
  'w-full rounded-md px-1.5 py-0.5 text-left text-xs font-semibold text-stone-600 outline-none transition-colors hover:bg-stone-100 focus-visible:ring-2 focus-visible:ring-ring aria-expanded:bg-stone-100';

/** One cell's chips. Past `max` the tail folds behind "N more" — which takes the
 *  last of the `max` slots, so a single hidden chip is never folded — and that
 *  button opens a scrollable list of every job in the cell. The list floats over
 *  the grid, so a busy hour never stretches its row (and every day's) taller.
 *
 *  `wide` lays the chips out in wrapping columns, for a cell with the room. */
export function PlannerChipStack({ cards, columnLabel, max, wide = false }: {
  cards: readonly PlannerCard[];
  /** Names the cell for people and screen readers: "Tue, Oct 12, 09:00". */
  columnLabel: string;
  max: number;
  wide?: boolean;
}) {
  if (cards.length === 0) return null;

  const shown = visibleCardCount(cards.length, max);
  const hidden = cards.length - shown;
  const all = countLabel(cards[0].kind, cards.length);

  return (
    <div className={wide ? WRAP_CLS : STACK_CLS}>
      {cards.slice(0, shown).map((card) => (
        <PlannerChip key={card.id} card={card} />
      ))}
      {hidden > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" aria-label={`Show all ${all} for ${columnLabel}`} className={MORE_CLS}>
              {hidden} more
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" aria-label={`${columnLabel}, ${all}`} className="w-80 max-w-[calc(100vw-2rem)] p-2">
            <p className="px-1.5 pb-2 text-sm font-semibold text-stone-900">
              {columnLabel}
              <span className="font-normal text-stone-500"> · {all}</span>
            </p>
            {/* Each chip opens its own detail card, so the list is a way in, not a dead end. */}
            <div className="flex max-h-80 flex-col gap-0.5 overflow-y-auto modal-scrollbar">
              {cards.map((card) => (
                <PlannerChip key={card.id} card={card} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
