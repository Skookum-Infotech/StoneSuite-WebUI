import { cn } from '@/lib/utils';
import { PLANNER_VIEWS } from '@/lib/plannerCalendar';
import type { PlannerView } from '@/lib/plannerCalendar';

/** Switches what the columns are: the day's hours, the week's days, or the
 *  month's days. */
export function PlannerViewSwitch({ view, onChange }: {
  view: PlannerView;
  onChange: (view: PlannerView) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Calendar columns"
      className="flex h-9 min-w-0 flex-1 items-stretch rounded-lg border border-stone-200 bg-white p-0.5 shadow-sm sm:inline-flex sm:h-8 sm:flex-none"
    >
      {PLANNER_VIEWS.map((option) => {
        const active = option.key === view;
        return (
          <button
            key={option.key}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(option.key)}
            className={cn(
              'flex-1 rounded-md px-3 text-sm font-medium transition-colors sm:flex-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
              active ? 'bg-brand text-stone-950 shadow-sm' : 'text-stone-600 hover:bg-stone-100',
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
