import { cn } from '@/lib/utils';
import { columnName } from '@/lib/plannerCalendar';
import type { PlannerColumn } from '@/lib/plannerCalendar';
import { countLabel } from '@/lib/plannerCards';
import type { PlannerCard } from '@/lib/plannerCards';

/** Dots a day shows before the rest are counted as "+N". */
const MAX_DOTS = 3;

/** One day of the phone calendar: its date over a dot for each job, in the job's
 *  status colour. A touch-sized button that selects the day; the name carries the
 *  count ("Tue, Mar 3, 2 jobs") so the dots can stay decorative. */
export function PlannerPhoneDay({ day, cards, selected, onSelect }: {
  day: PlannerColumn;
  cards: readonly PlannerCard[];
  selected: boolean;
  onSelect: (date: string) => void;
}) {
  const name = columnName(day);
  const label = cards.length > 0 ? `${name}, ${countLabel(cards[0].kind, cards.length)}` : name;

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={selected}
      aria-current={day.isToday ? 'date' : undefined}
      onClick={() => onSelect(day.date)}
      className={cn(
        'flex min-h-12 min-w-0 flex-col items-center gap-1 rounded-lg px-0.5 py-1.5 outline-none transition-colors',
        'focus-visible:ring-2 focus-visible:ring-ring',
        selected ? 'bg-white ring-2 ring-stone-900' : 'hover:bg-stone-100',
        !day.inMonth && !selected && 'bg-stone-50',
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-medium',
          day.isToday ? 'bg-brand font-semibold text-stone-900' : day.inMonth ? 'text-stone-900' : 'text-stone-500',
        )}
      >
        {day.dayOfMonth}
      </span>
      <span aria-hidden="true" className="flex h-2 items-center gap-0.5">
        {cards.slice(0, MAX_DOTS).map((card) => (
          // A status colour is data, not a design token — the same inline fill the chips use.
          <span key={card.id} style={{ backgroundColor: card.chipColor }} className="size-1.5 rounded-full" />
        ))}
        {cards.length > MAX_DOTS && (
          <span className="text-xs font-semibold leading-none text-stone-600">+{cards.length - MAX_DOTS}</span>
        )}
      </span>
    </button>
  );
}
