import { cn } from '@/lib/utils';
import { columnName, weeksOf } from '@/lib/plannerCalendar';
import type { PlannerColumn } from '@/lib/plannerCalendar';
import type { PlannerCard } from '@/lib/plannerCards';
import { PlannerChipStack } from './PlannerChipStack';
import { GRID_FRAME_CLS, SCROLL_BOX_CLS } from './plannerLayout';

/** A cell holds this many chips; past it the rest fold behind "N more". */
const MAX_CELL_CHIPS = 4;

function MonthCell({ day, cards }: { day: PlannerColumn; cards: readonly PlannerCard[] }) {
  const name = columnName(day);
  return (
    <div
      role="cell"
      aria-label={name}
      aria-current={day.isToday ? 'date' : undefined}
      className={cn(
        'min-h-28 min-w-0 border-r border-stone-200 p-1 last:border-r-0',
        !day.inMonth && 'bg-stone-50',
        day.isToday && 'bg-brand/5',
      )}
    >
      <p className="mb-1 flex justify-center">
        <span
          className={cn(
            'inline-flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-medium',
            day.isToday ? 'bg-brand font-semibold text-stone-900' : day.inMonth ? 'text-stone-900' : 'text-stone-500',
          )}
        >
          {/* The first of a month names the month, so the grid reads "30 31 1 Oct 2". */}
          {day.dayOfMonth === 1 ? `${day.dayOfMonth} ${day.monthAbbr}` : day.dayOfMonth}
        </span>
      </p>
      <PlannerChipStack cards={cards} columnLabel={name} max={MAX_CELL_CHIPS} />
    </div>
  );
}

/** The Month view: a calendar grid of whole weeks, one row each, with every
 *  day's jobs as chips in its cell. The days of the neighbouring months that
 *  fill the first and last weeks are drawn dimmed, with their jobs. Scrolls in
 *  its own box when the weeks don't fit, keeping the weekday names in view. */
export function PlannerMonthGrid({ columns, buckets, label }: {
  columns: readonly PlannerColumn[];
  buckets: ReadonlyMap<string, PlannerCard[]>;
  /** The activity's name, for the table's accessible name. */
  label: string;
}) {
  const weeks = weeksOf(columns);

  return (
    <div className={cn(GRID_FRAME_CLS, SCROLL_BOX_CLS)}>
      <div role="table" aria-label={`${label} calendar`}>
        <div role="row" className="sticky top-0 z-20 grid grid-cols-7 border-b border-stone-200 bg-white">
          {(weeks[0] ?? []).map((day) => (
            <div
              key={day.key}
              role="columnheader"
              className="border-r border-stone-200 px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-stone-500 last:border-r-0"
            >
              {day.label}
            </div>
          ))}
        </div>

        {weeks.map((week) => (
          <div key={week[0].key} role="row" className="grid grid-cols-7 border-b border-stone-200 last:border-b-0">
            {week.map((day) => (
              <MonthCell key={day.key} day={day} cards={buckets.get(day.key) ?? []} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
