import { useEffect, useState } from 'react';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronDown, ChevronRight, Inbox, Star } from 'lucide-react';
import { feedbackService } from '@/services/feedbackService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner } from '@/components/tenant/ui';
import { Button } from '@/components/ui/button';
import { FeedbackTicketThread } from '@/components/feedback/FeedbackTicketThread';
import { feedbackCategoryOption, feedbackStatusLabel, formatFeedbackTime, FEEDBACK_STATUS_COLORS } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import type { FeedbackStatus, FeedbackTicket } from '@/types/feedback';

function TicketRow({ ticket, expanded, onToggle }: { ticket: FeedbackTicket; expanded: boolean; onToggle: () => void }) {
  const category = feedbackCategoryOption(ticket.category);
  return (
    <li className="border-b border-stone-100 last:border-b-0 dark:border-white/5">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        aria-label={`${expanded ? 'Collapse' : 'Expand'} ticket ${ticket.ticketNumber}`}
        className="flex w-full items-center gap-2.5 px-3.5 py-3 text-left transition-colors hover:bg-stone-50 dark:hover:bg-white/[0.03]"
      >
        {expanded ? <ChevronDown className="size-3.5 shrink-0 text-stone-400" /> : <ChevronRight className="size-3.5 shrink-0 text-stone-400" />}
        <category.icon className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-2xs font-semibold text-stone-500 dark:text-stone-400">{ticket.ticketNumber}</span>
            {typeof ticket.rating === 'number' && ticket.rating > 0 && (
              <span className="inline-flex items-center gap-0.5 text-2xs text-amber-500">
                <Star className="size-2.5 fill-amber-400" />{ticket.rating}
              </span>
            )}
          </div>
          <p className="truncate text-xs text-stone-700 dark:text-stone-200">{ticket.description}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className={cn('rounded-full px-2 py-0.5 text-2xs font-semibold', FEEDBACK_STATUS_COLORS[ticket.status as FeedbackStatus])}>
            {feedbackStatusLabel(ticket.status)}
          </span>
          <span className="text-2xs text-stone-400">{formatFeedbackTime(ticket.createdAt)}</span>
        </div>
      </button>
      {expanded && <FeedbackTicketThread ticketId={ticket.id} />}
    </li>
  );
}

// The "My Tickets" tab: the reporter's own tickets, newest first, expandable
// inline into the full thread (FeedbackTicketThread) rather than navigating
// to a dedicated page — the panel is the whole surface for reporters.
export function FeedbackTicketList() {
  const queryClient = useQueryClient();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const ticketsQ = useInfiniteQuery({
    queryKey: ['feedback-mine'],
    queryFn: ({ pageParam }) => feedbackService.listMine(pageParam),
    initialPageParam: '',
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
  });

  const markSeenMutation = useMutation({
    mutationFn: feedbackService.markSeen,
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['feedback-unread-count'] }),
  });

  // Clearing the badge is a side effect of the tab actually being viewed —
  // fires once per mount (the parent only mounts this while the tab is
  // active), matching the "cleared when they open My Tickets" design.
  useEffect(() => {
    markSeenMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire-once-on-mount is deliberate, not a reactive effect
  }, []);

  const tickets = ticketsQ.data?.pages.flatMap((p) => p.tickets) ?? [];

  if (ticketsQ.isLoading) return <div className="flex justify-center py-8"><Spinner label="Loading your tickets…" /></div>;
  if (ticketsQ.isError) {
    return <p className="px-3.5 py-4 text-xs text-destructive">{apiErrorMessage(ticketsQ.error, 'Failed to load your tickets.')}</p>;
  }
  if (tickets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Inbox className="mb-2 size-8 text-stone-300 dark:text-stone-600" aria-hidden="true" />
        <p className="text-xs font-medium text-stone-500 dark:text-stone-400">No feedback submitted yet.</p>
        <p className="mt-0.5 text-2xs text-stone-400">Anything you report shows up here.</p>
      </div>
    );
  }

  return (
    <div>
      <ul>
        {tickets.map((ticket) => (
          <TicketRow
            key={ticket.id}
            ticket={ticket}
            expanded={expandedId === ticket.id}
            onToggle={() => setExpandedId((cur) => (cur === ticket.id ? null : ticket.id))}
          />
        ))}
      </ul>
      {ticketsQ.hasNextPage && (
        <div className="flex justify-center py-3">
          <Button
            type="button" variant="outline" size="sm"
            onClick={() => void ticketsQ.fetchNextPage()}
            disabled={ticketsQ.isFetchingNextPage}
          >
            {ticketsQ.isFetchingNextPage ? 'Loading…' : 'Load more'}
          </Button>
        </div>
      )}
    </div>
  );
}
