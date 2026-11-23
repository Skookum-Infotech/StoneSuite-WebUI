import { Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FeedbackStatusPill } from '@/components/feedback/FeedbackStatusPill';
import { feedbackCategoryOption, feedbackStatusLabel, formatFeedbackTime } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import type { FeedbackTicket } from '@/types/feedback';

interface RailPaging {
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  onLoadMore: () => void;
}

function TicketRow({ ticket, selected, onSelect }: { ticket: FeedbackTicket; selected: boolean; onSelect: () => void }) {
  const category = feedbackCategoryOption(ticket.category);
  const rated = typeof ticket.rating === 'number' && ticket.rating > 0;

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        aria-label={`Open ticket ${ticket.ticketNumber}, ${feedbackStatusLabel(ticket.status)}`}
        className={cn(
          'flex w-full items-start gap-3 border-l-2 px-4 py-3.5 text-left transition-colors duration-150',
          selected
            ? 'border-l-brand bg-stone-50 dark:bg-white/[0.06]'
            : 'border-l-transparent hover:bg-stone-50/70 dark:hover:bg-white/[0.03]',
        )}
      >
        <span
          className={cn(
            'flex size-9 shrink-0 items-center justify-center rounded-lg transition-colors duration-150',
            selected ? 'bg-brand/25 text-brand-dark' : 'bg-stone-100 text-stone-500 dark:bg-white/10 dark:text-stone-400',
          )}
        >
          <category.icon className="size-4" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="text-sm font-semibold text-stone-900 dark:text-stone-100">{ticket.ticketNumber}</span>
              <span className="truncate text-xs text-stone-500 dark:text-stone-400">{category.label}</span>
            </span>
            <FeedbackStatusPill status={ticket.status} />
          </span>
          <span className="mt-1 line-clamp-2 text-sm text-stone-600 dark:text-stone-300">{ticket.description}</span>
          <span className="mt-1.5 flex items-center justify-between gap-2 text-xs text-stone-500 dark:text-stone-400">
            <span>{formatFeedbackTime(ticket.createdAt)}</span>
            {rated && (
              <span aria-label={`Rated ${ticket.rating} out of 5`} className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <Star className="size-3 fill-amber-400 text-amber-400" aria-hidden="true" />
                {ticket.rating}
              </span>
            )}
          </span>
        </span>
      </button>
    </li>
  );
}

// The left-hand list of the My Tickets inbox: the reporter's own tickets in the
// order the server returned them (newest first), with keyset paging passed
// straight through — the cursor itself is never touched here.
export function FeedbackTicketRail({
  tickets,
  selectedId,
  onSelect,
  paging,
}: {
  tickets: FeedbackTicket[];
  selectedId: string | null;
  onSelect: (ticketId: string) => void;
  paging: RailPaging;
}) {
  return (
    <nav aria-label="Your tickets" className="modal-scrollbar min-h-0 flex-1 overflow-y-auto">
      <ul className="divide-y divide-stone-100 dark:divide-white/5">
        {tickets.map((ticket) => (
          <TicketRow
            key={ticket.id}
            ticket={ticket}
            selected={ticket.id === selectedId}
            onSelect={() => onSelect(ticket.id)}
          />
        ))}
      </ul>
      {paging.hasNextPage && (
        <div className="flex justify-center border-t border-stone-100 p-3 dark:border-white/5">
          <Button type="button" variant="outline" size="sm" onClick={paging.onLoadMore} disabled={paging.isFetchingNextPage}>
            {paging.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </nav>
  );
}
