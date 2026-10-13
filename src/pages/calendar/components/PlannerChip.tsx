import { Check, TriangleAlert } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { PlannerCard } from '@/lib/plannerCards';
import { PlannerEventDetail } from './PlannerEventDetail';

/** One job on the calendar, as a small chip in its status colour: the time (a
 *  date-only invoice has none), the order or invoice number and the customer on
 *  one line. Pressing it opens the detail card in a popover beside it, so the
 *  grid stays in view and the way through to the order is one click further.
 *
 *  A chip is `text-xs` throughout; weight and the fill carry the hierarchy. */
export function PlannerChip({ card }: { card: PlannerCard }) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`${card.title}, ${card.customer}, ${card.whenLabel}, ${card.statusLabel}`}
          // A status colour is data, not a design token, so it can't be a class —
          // the same inline fill the status Badge uses.
          style={{ backgroundColor: card.chipColor }}
          className={cn(
            'flex w-full min-w-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-left text-xs text-white',
            'outline-none transition-[filter] hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring',
            'focus-visible:ring-offset-1 aria-expanded:ring-2 aria-expanded:ring-stone-900/60',
          )}
        >
          {card.done && <Check className="size-3 shrink-0" aria-hidden="true" />}
          {card.overdue && <TriangleAlert className="size-3 shrink-0" aria-hidden="true" />}
          {!card.allDay && <span className="shrink-0 font-semibold tabular-nums">{card.timeLabel}</span>}
          <span className="min-w-0 truncate">
            <span className="font-semibold">{card.title}</span>
            {card.customer && <span className="opacity-90"> {card.customer}</span>}
          </span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 max-w-[calc(100vw-2rem)] p-4">
        <PlannerEventDetail card={card} />
      </PopoverContent>
    </Popover>
  );
}
