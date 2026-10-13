import { Link } from 'react-router-dom';
import { ArrowUpRight, Check } from 'lucide-react';
import { Badge } from '@/components/tenant/ui';
import { Button } from '@/components/ui/button';
import type { PlannerCard } from '@/lib/plannerCards';

/** The detail card a chip opens: when it is and where it stands, who it is for,
 *  and one clear button through to the order (or the invoice). On an invoice a
 *  second link keeps the order it was made from one click away. */
export function PlannerEventDetail({ card }: { card: PlannerCard }) {
  return (
    <div className="flex flex-col gap-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge color={card.statusColor}>{card.statusLabel}</Badge>
        <span className="text-xs font-medium text-stone-500">{card.whenLabel}</span>
      </div>

      <div className="min-w-0">
        <p className="break-words text-base font-bold text-stone-900">{card.title}</p>
        {card.origin && (
          <Link
            to={card.origin.href}
            aria-label={`Open ${card.origin.label}`}
            className="text-xs font-medium text-stone-500 outline-none hover:underline focus-visible:underline"
          >
            From {card.origin.label}
          </Link>
        )}
      </div>

      <div className="flex flex-col gap-0.5">
        <p className="break-words text-stone-700">{card.customer}</p>
        {card.stage && <p className="break-words font-medium text-stone-600">{card.stage}</p>}
        {card.meta && <p className="break-words text-xs text-stone-500">{card.meta}</p>}
      </div>

      {card.notes && <p className="break-words text-xs italic text-stone-500">{card.notes}</p>}
      {card.doneLabel && (
        <p className="flex items-center gap-1 text-xs font-medium text-emerald-700">
          <Check className="size-3.5 shrink-0" aria-hidden="true" />
          <span>{card.doneLabel}</span>
        </p>
      )}

      <Button asChild size="lg" className="w-full">
        <Link to={card.href} aria-label={card.ariaLabel}>
          {card.openLabel}
          <ArrowUpRight aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );
}
