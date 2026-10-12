import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { Badge } from '@/components/tenant/ui';
import { cn } from '@/lib/utils';
import type { PlannerCard } from '@/lib/plannerCards';

/** One job card: the time, the order number (a link), the customer and the
 *  stage, with a status pill. The whole card opens the order — or the invoice on
 *  the Invoicing tab, where a second link keeps the order one click away.
 *
 *  Two type sizes only: the order number at `text-sm`, everything else at
 *  `text-xs` (hierarchy comes from weight and colour, never from a third size). */
export function PlannerEventCard({ card }: { card: PlannerCard }) {
  return (
    <article
      className={cn(
        'relative rounded-md border bg-white p-2 text-xs shadow-xs transition-shadow',
        'hover:shadow-md focus-within:ring-2 focus-within:ring-ring/50',
        card.overdue ? 'border-red-200 border-l-2 border-l-red-500' : 'border-stone-200',
        card.done && 'bg-stone-50',
      )}
    >
      {/* Wraps in a narrow column: the pill drops under the time. */}
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="font-semibold tabular-nums text-stone-700">{card.timeLabel}</span>
        <Badge color={card.statusColor} size="sm">{card.statusLabel}</Badge>
      </div>

      <Link
        to={card.href}
        aria-label={card.ariaLabel}
        className={cn(
          // The number is the card's identity: it wraps rather than truncates.
          'mt-1 block break-words text-sm font-bold text-stone-900 outline-none hover:underline focus-visible:underline',
          // Stretched link: the card's whole surface is the click target.
          "after:absolute after:inset-0 after:content-['']",
        )}
      >
        {card.title}
      </Link>

      {card.origin && (
        // Later in the DOM than the stretched link above, so it paints over it.
        <Link
          to={card.origin.href}
          aria-label={`Open ${card.origin.label}`}
          className="relative block truncate font-medium text-stone-500 outline-none hover:underline focus-visible:underline"
        >
          From {card.origin.label}
        </Link>
      )}

      <p className="line-clamp-2 break-words text-stone-700">{card.customer}</p>
      {card.stage && <p className="line-clamp-2 font-medium text-stone-600">{card.stage}</p>}
      {card.meta && <p className="line-clamp-2 text-stone-500">{card.meta}</p>}
      {card.notes && (
        <p className="mt-1 line-clamp-2 italic text-stone-500" title={card.notes}>
          {card.notes}
        </p>
      )}
      {card.doneLabel && (
        <p className="mt-1 flex items-center gap-1 font-medium text-emerald-700">
          <Check className="size-3 shrink-0" aria-hidden="true" />
          <span className="truncate">{card.doneLabel}</span>
        </p>
      )}
    </article>
  );
}
