import { columnName } from '@/lib/plannerCalendar';
import type { PlannerColumn } from '@/lib/plannerCalendar';
import { countLabel } from '@/lib/plannerCards';
import type { PlannerCard } from '@/lib/plannerCards';
import { PlannerEventCard } from './PlannerEventCard';

/** The phone's list of one day's jobs, as full cards that go straight to the
 *  order (or invoice). Nothing is folded: a day's list is the page's whole
 *  scroll, so there is no grid to keep short. `quiet` is the page's own "nothing
 *  planned" message already covering an empty window, so the day stays silent. */
export function PlannerDayList({ day, cards, quiet }: {
  day: PlannerColumn;
  cards: readonly PlannerCard[];
  quiet: boolean;
}) {
  const name = columnName(day);

  return (
    <section aria-label={name} className="flex flex-col gap-2">
      <h3 className="flex items-baseline gap-2 text-sm font-semibold text-stone-900">
        {name}
        {cards.length > 0 && (
          <span className="text-xs font-normal text-stone-500">{countLabel(cards[0].kind, cards.length)}</span>
        )}
      </h3>
      {cards.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {cards.map((card) => (
            <li key={card.id}>
              <PlannerEventCard card={card} />
            </li>
          ))}
        </ul>
      ) : (
        !quiet && <p className="text-xs text-stone-500">Nothing scheduled on {name}.</p>
      )}
    </section>
  );
}
