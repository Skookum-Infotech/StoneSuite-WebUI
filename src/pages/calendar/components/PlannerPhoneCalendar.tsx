import { weeksOf } from '@/lib/plannerCalendar';
import type { PlannerColumn, PlannerView } from '@/lib/plannerCalendar';
import type { PlannerCard } from '@/lib/plannerCards';
import { PlannerDayList } from './PlannerDayList';
import { PlannerPhoneDay } from './PlannerPhoneDay';

/** The calendar for a phone, laid out like Google Calendar's: a compact picture
 *  of the window on top — a month's grid, or a week's strip — with a dot per job,
 *  and the selected day's jobs as cards underneath. The Day view is only that
 *  list. Tapping a day selects it (`onSelect`) without leaving the view. */
export function PlannerPhoneCalendar({ view, columns, buckets, selected, onSelect }: {
  view: PlannerView;
  columns: readonly PlannerColumn[];
  buckets: ReadonlyMap<string, PlannerCard[]>;
  /** The selected day, `yyyy-mm-dd`. */
  selected: string;
  onSelect: (date: string) => void;
}) {
  const day = columns.find((column) => column.date === selected) ?? columns[0];
  const weeks = view === 'day' ? [] : weeksOf(columns);
  const anyWork = columns.some((column) => (buckets.get(column.key)?.length ?? 0) > 0);

  return (
    <div className="flex flex-col gap-4">
      {weeks.length > 0 && (
        <div role="group" aria-label="Pick a day" className="rounded-lg border border-stone-200 bg-white p-1.5">
          {/* Each day button already says its weekday, so the header row is for sighted users. */}
          <div
            aria-hidden="true"
            className="grid grid-cols-7 pb-1 text-center text-xs font-semibold uppercase tracking-wide text-stone-500"
          >
            {weeks[0].map((weekday) => (
              <span key={weekday.key}>{weekday.label}</span>
            ))}
          </div>
          <div className="flex flex-col gap-0.5">
            {weeks.map((week) => (
              <div key={week[0].key} className="grid grid-cols-7 gap-0.5">
                {week.map((cell) => (
                  <PlannerPhoneDay
                    key={cell.key}
                    day={cell}
                    cards={buckets.get(cell.key) ?? []}
                    selected={cell.date === day.date}
                    onSelect={onSelect}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      )}
      <PlannerDayList day={day} cards={buckets.get(day.key) ?? []} quiet={!anyWork} />
    </div>
  );
}
