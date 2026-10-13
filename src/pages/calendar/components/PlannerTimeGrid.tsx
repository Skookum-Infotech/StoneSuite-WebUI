import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';
import { columnName } from '@/lib/plannerCalendar';
import type { PlannerColumn } from '@/lib/plannerCalendar';
import { PLANNER_HOUR_ROWS, bucketByHour } from '@/lib/plannerPlacement';
import type { PlannerCard } from '@/lib/plannerCards';
import { PlannerChipStack } from './PlannerChipStack';
import { GRID_FRAME_CLS, SCROLL_BOX_CLS } from './plannerLayout';

// One literal class per column count a view can have (a day, a week): Tailwind's
// scanner has to see each class whole, and inline styles are off the table. The
// first track is the hour gutter. A day column is never narrower than 7rem,
// which keeps a week inside a 1280px laptop.
const GRID_TEMPLATES: Record<number, string> = {
  1: 'grid-cols-[4.5rem_minmax(14rem,1fr)]',
  7: 'grid-cols-[4.5rem_repeat(7,minmax(7rem,1fr))]',
};
const FALLBACK_TEMPLATE = GRID_TEMPLATES[7];

/** Chips one hour of one day holds before the rest fold behind "N more". */
const MAX_HOUR_CHIPS = 4;
/** The date-only row has the whole body to itself, so it holds more. */
const MAX_DATE_ONLY_CHIPS = 8;
const GUTTER_HEADER_LABEL = 'Time';
const DATE_ONLY_LABEL = 'All day';

const ROW_HEADER_CLS =
  'sticky left-0 z-10 border-b border-r border-stone-200 bg-white px-2 py-1 text-right text-xs text-stone-500';

function dayCellCls(column: PlannerColumn, extra: string): string {
  return cn(
    'min-w-0 border-b border-r border-stone-200 p-0.5 last:border-r-0',
    column.isToday && 'bg-brand/5',
    extra,
  );
}

/** The Week and Day views, laid out like a calendar: a day column per day under
 *  its weekday and date, and an hour gutter down the left with each job's chip in
 *  the row of its hour (a busy hour grows taller rather than overlapping).
 *
 *  Activities with no time of day — invoices, due on a date — have no hours to
 *  sit on, so their chips fill one "All day" row instead. Scrolls in its own box
 *  when the rows or columns don't fit, keeping the day headers and the gutter in
 *  view. */
export function PlannerTimeGrid({ columns, buckets, label, timed }: {
  columns: readonly PlannerColumn[];
  buckets: ReadonlyMap<string, PlannerCard[]>;
  /** The activity's name, for the table's accessible name. */
  label: string;
  /** Whether the cards have a time of day to place on the hour rows. */
  timed: boolean;
}) {
  const template = GRID_TEMPLATES[columns.length] ?? FALLBACK_TEMPLATE;
  const scroller = useRef<HTMLDivElement>(null);
  const todayHeader = useRef<HTMLDivElement>(null);
  const hourBuckets = columns.map((column) => bucketByHour(buckets.get(column.key) ?? []));

  // A window opens with today centred, so a narrow screen never starts out of
  // sight of it. The page remounts the grid for each window, so this runs once
  // per window.
  useEffect(() => {
    const box = scroller.current;
    const cell = todayHeader.current;
    if (!box || !cell) return;
    box.scrollLeft = Math.max(0, cell.offsetLeft - (box.clientWidth - cell.offsetWidth) / 2);
  }, []);

  return (
    <div ref={scroller} className={cn(GRID_FRAME_CLS, SCROLL_BOX_CLS)}>
      <div role="table" aria-label={`${label} calendar`} className={cn('grid w-full', template)}>
        <div role="row" className="contents">
          <div
            role="columnheader"
            className="sticky left-0 top-0 z-30 border-b border-r border-stone-200 bg-white"
          >
            <span className="sr-only">{GUTTER_HEADER_LABEL}</span>
          </div>
          {columns.map((column) => (
            <div
              key={column.key}
              ref={column.isToday ? todayHeader : undefined}
              role="columnheader"
              aria-label={columnName(column)}
              aria-current={column.isToday ? 'date' : undefined}
              className="sticky top-0 z-20 border-b border-r border-stone-200 bg-white px-1 py-2 text-center last:border-r-0"
            >
              <p
                className={cn(
                  'text-xs font-semibold uppercase tracking-wide',
                  column.isToday ? 'text-stone-900' : 'text-stone-500',
                )}
              >
                {column.label}
              </p>
              <p
                className={cn(
                  'mx-auto mt-1 flex size-10 items-center justify-center rounded-full text-xl',
                  column.isToday ? 'bg-brand font-semibold text-stone-900' : 'text-stone-800',
                )}
              >
                {column.dayOfMonth}
              </p>
            </div>
          ))}
        </div>

        {timed ? (
          PLANNER_HOUR_ROWS.map((row) => (
            <div key={row.hour} role="row" className="contents">
              <div role="rowheader" className={ROW_HEADER_CLS}>
                {row.label}
              </div>
              {columns.map((column, i) => {
                const cellName = `${columnName(column)}, ${row.label}`;
                return (
                  <div key={column.key} role="cell" aria-label={cellName} className={dayCellCls(column, 'min-h-14')}>
                    <PlannerChipStack
                      cards={hourBuckets[i].get(row.hour) ?? []}
                      columnLabel={cellName}
                      max={MAX_HOUR_CHIPS}
                    />
                  </div>
                );
              })}
            </div>
          ))
        ) : (
          <div role="row" className="contents">
            <div role="rowheader" className={ROW_HEADER_CLS}>
              {DATE_ONLY_LABEL}
            </div>
            {columns.map((column) => (
              <div
                key={column.key}
                role="cell"
                aria-label={`${columnName(column)}, ${DATE_ONLY_LABEL}`}
                className={dayCellCls(column, 'min-h-48')}
              >
                <PlannerChipStack
                  cards={buckets.get(column.key) ?? []}
                  columnLabel={columnName(column)}
                  max={MAX_DATE_ONLY_CHIPS}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
