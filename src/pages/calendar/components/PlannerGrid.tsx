import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { columnName } from '@/lib/plannerCalendar';
import type { PlannerColumn } from '@/lib/plannerCalendar';
import { countLabel } from '@/lib/plannerCards';
import type { PlannerCard } from '@/lib/plannerCards';
import { PlannerColumnCards } from './PlannerColumnCards';

// One literal class per column count a view can have (a day's hours, a week, a
// month of 28–31 days): Tailwind's scanner has to see each class whole, and
// inline styles are off the table. The first track is the row label. A column
// is never narrower than 7.5rem, which keeps a week inside a 1280px laptop.
const GRID_TEMPLATES: Record<number, string> = {
  1: 'grid-cols-[8rem_minmax(14rem,1fr)]',
  7: 'grid-cols-[8rem_repeat(7,minmax(7.5rem,1fr))]',
  14: 'grid-cols-[8rem_repeat(14,minmax(7.5rem,1fr))]',
  28: 'grid-cols-[8rem_repeat(28,minmax(7.5rem,1fr))]',
  29: 'grid-cols-[8rem_repeat(29,minmax(7.5rem,1fr))]',
  30: 'grid-cols-[8rem_repeat(30,minmax(7.5rem,1fr))]',
  31: 'grid-cols-[8rem_repeat(31,minmax(7.5rem,1fr))]',
};
const FALLBACK_TEMPLATE = GRID_TEMPLATES[7];
const ROW_HEADER_LABEL = 'Activity';

// The app scrolls the whole page, not a pane, so a column's sticky header can
// only stay in view if the grid scrolls inside a box of its own. This caps that
// box at the viewport less the chrome above it (top bar, breadcrumb, page header,
// tabs, padding); the allowance grows where the page padding does.
const SCROLL_BOX_CLS =
  'md:max-h-[calc(100dvh-22rem)] xl:max-h-[calc(100dvh-20rem)] 3xl:max-h-[calc(100dvh-22rem)] 4xl:max-h-[calc(100dvh-24rem)]';

function headerTint(column: PlannerColumn): string {
  if (column.isToday) return 'bg-brand/20';
  return column.isWeekend ? 'bg-stone-100' : 'bg-stone-50';
}

/** The resource calendar: one row — the activity — across the view's columns,
 *  with each column's job cards stacked in its cell. Scrolls inside its own box
 *  when the columns or the cards don't fit, keeping the row label and the column
 *  headers in view. */
export function PlannerGrid({ columns, buckets, rowLabel }: {
  columns: readonly PlannerColumn[];
  buckets: ReadonlyMap<string, PlannerCard[]>;
  rowLabel: string;
}) {
  const template = GRID_TEMPLATES[columns.length] ?? FALLBACK_TEMPLATE;
  const scroller = useRef<HTMLDivElement>(null);
  const todayCell = useRef<HTMLDivElement>(null);

  // A window opens with today centred, so a month never starts out of sight of it.
  // The page remounts the grid for each window, so this runs once per window.
  useEffect(() => {
    const box = scroller.current;
    const cell = todayCell.current;
    if (!box || !cell) return;
    box.scrollLeft = Math.max(0, cell.offsetLeft - (box.clientWidth - cell.offsetWidth) / 2);
  }, []);

  return (
    <div
      ref={scroller}
      className={cn(
        'relative min-h-80 flex-1 overflow-auto rounded-lg border border-stone-200 bg-white modal-scrollbar',
        SCROLL_BOX_CLS,
      )}
    >
      <div role="table" aria-label={`${rowLabel} calendar`} className={cn('grid w-full', template)}>
        <div role="row" className="contents">
          <div
            role="columnheader"
            className="sticky left-0 top-0 z-30 border-b border-r border-stone-200 bg-stone-50 px-3 py-2 text-xs font-semibold text-stone-500"
          >
            {ROW_HEADER_LABEL}
          </div>
          {columns.map((column) => {
            const cards = buckets.get(column.key) ?? [];
            return (
              // The cell itself is opaque, so cards scrolling underneath never
              // show through a translucent tint; the tint sits one level in.
              <div
                key={column.key}
                role="columnheader"
                aria-current={column.isToday ? 'date' : undefined}
                className="sticky top-0 z-20 border-b border-r border-stone-200 bg-white"
              >
                <div className={cn('px-2 py-2 text-center', headerTint(column))}>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-sm font-semibold text-stone-800">{column.label}</span>
                    {cards.length > 0 && (
                      <span className="rounded-full bg-stone-200 px-1.5 text-xs font-semibold tabular-nums text-stone-700">
                        <span aria-hidden="true">{cards.length}</span>
                        <span className="sr-only">{countLabel(cards[0].kind, cards.length)}</span>
                      </span>
                    )}
                  </div>
                  {column.subLabel && <p className="text-xs text-stone-500">{column.subLabel}</p>}
                </div>
              </div>
            );
          })}
        </div>

        <div role="row" className="contents">
          <div
            role="rowheader"
            className="sticky left-0 z-10 border-r border-stone-200 bg-white px-3 py-3 text-sm font-semibold text-stone-800"
          >
            {rowLabel}
          </div>
          {columns.map((column) => (
            <div
              key={column.key}
              ref={column.isToday ? todayCell : undefined}
              role="cell"
              className={cn(
                'min-h-32 border-r border-stone-100 p-1.5',
                column.isToday && 'bg-brand/5',
                column.isWeekend && !column.isToday && 'bg-stone-50/70',
              )}
            >
              <PlannerColumnCards cards={buckets.get(column.key) ?? []} columnLabel={columnName(column)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
