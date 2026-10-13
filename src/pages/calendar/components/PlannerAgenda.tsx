import { cn } from '@/lib/utils';
import { columnName, openDayLabel } from '@/lib/plannerCalendar';
import type { PlannerColumn } from '@/lib/plannerCalendar';
import { countLabel } from '@/lib/plannerCards';
import type { PlannerCard } from '@/lib/plannerCards';
import { PlannerColumnCards } from './PlannerColumnCards';

/** The calendar for a phone: a day-by-day list instead of a grid. Only the days
 *  that have work are listed, each as a heading over its stacked cards, so a
 *  month isn't thirty screens of empty days. */
export function PlannerAgenda({ columns, buckets, label, onSelectDay }: {
  columns: readonly PlannerColumn[];
  buckets: ReadonlyMap<string, PlannerCard[]>;
  /** The activity's name, for the list's accessible name. */
  label: string;
  /** Opens a day in the Day view: each day's name is a button for it. Leave it
   *  out when the list already is that one day. */
  onSelectDay?: (date: string) => void;
}) {
  const busy = columns.filter((column) => (buckets.get(column.key)?.length ?? 0) > 0);
  if (busy.length === 0) return null;

  return (
    <ol aria-label={`${label} by day`} className="flex flex-col gap-3">
      {busy.map((column) => {
        const cards = buckets.get(column.key) ?? [];
        const name = columnName(column);
        return (
          <li
            key={column.key}
            aria-current={column.isToday ? 'date' : undefined}
            className={cn('overflow-hidden rounded-lg border bg-white', column.isToday ? 'border-brand' : 'border-stone-200')}
          >
            <h3
              className={cn(
                'flex items-baseline justify-between gap-3 border-b border-stone-200 px-3 py-2',
                column.isToday ? 'bg-brand/20' : 'bg-stone-50',
              )}
            >
              {onSelectDay ? (
                <button
                  type="button"
                  aria-label={openDayLabel(column)}
                  onClick={() => onSelectDay(column.date)}
                  className="rounded text-left text-sm font-semibold text-stone-800 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {name}
                </button>
              ) : (
                <span className="text-sm font-semibold text-stone-800">{name}</span>
              )}
              <span className="text-xs text-stone-500">{countLabel(cards[0].kind, cards.length)}</span>
            </h3>
            <div className="p-2">
              <PlannerColumnCards cards={cards} columnLabel={name} className="grid gap-2 sm:grid-cols-2" />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
