import { ChevronLeft, ChevronRight } from 'lucide-react';
import { DatePicker } from '@/components/ui/date-picker';

/** What the navigator needs to know about the window on screen. */
export interface PlannerSpan {
  /** Heading, e.g. "Oct 12 – 18, 2026". */
  label: string;
  /** The window's anchor date (`yyyy-mm-dd`), shown in the jump-to-date picker. */
  date: string;
  /** What one step moves by, for the buttons' names: "day", "week", "month". */
  unit: string;
  /** Today is already inside the window, so "Today" has nothing to do. */
  showsToday: boolean;
}

// Every control in the toolbar is 32px high and 14px type, to match the date
// picker's own trigger.
const NAV_BUTTON_CLS =
  'inline-flex size-8 items-center justify-center rounded-lg border border-stone-200 bg-white text-stone-600 shadow-sm transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50';
const TODAY_BUTTON_CLS =
  'h-8 rounded-lg border border-stone-200 bg-white px-3 text-sm font-medium text-stone-700 shadow-sm transition-colors hover:bg-stone-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 disabled:cursor-default disabled:opacity-50';

/** Previous / next / Today, the window's heading and a jump-to-date picker.
 *  `onStep` takes -1 (back), 1 (forward) or 0 (today).
 *
 *  Returns bare siblings, not a wrapper, so the page's toolbar can wrap them
 *  together with the view switch as one run of controls — on a phone the picker
 *  and the switch share a line instead of each taking their own. */
export function PlannerNavigator({ span, onStep, onPick }: {
  span: PlannerSpan;
  onStep: (step: -1 | 0 | 1) => void;
  onPick: (date: string) => void;
}) {
  return (
    <>
      <div className="inline-flex items-center gap-1">
        <button type="button" onClick={() => onStep(-1)} aria-label={`Previous ${span.unit}`} className={NAV_BUTTON_CLS}>
          <ChevronLeft className="size-4" aria-hidden="true" />
        </button>
        <button type="button" onClick={() => onStep(1)} aria-label={`Next ${span.unit}`} className={NAV_BUTTON_CLS}>
          <ChevronRight className="size-4" aria-hidden="true" />
        </button>
      </div>
      <button
        type="button"
        onClick={() => onStep(0)}
        disabled={span.showsToday}
        aria-label="Go to today"
        className={TODAY_BUTTON_CLS}
      >
        Today
      </button>
      <h2 className="whitespace-nowrap text-sm font-semibold text-stone-900" aria-live="polite">
        {span.label}
      </h2>
      <div className="min-w-32 flex-1 sm:w-36 sm:flex-none">
        <DatePicker value={span.date} onChange={onPick} label="Jump to date" />
      </div>
    </>
  );
}
