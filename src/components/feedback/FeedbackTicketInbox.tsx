import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Inbox } from 'lucide-react';
import { feedbackService } from '@/services/feedbackService';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote } from '@/components/tenant/ui';
import { Button } from '@/components/ui/button';
import { FeedbackTicketDetail } from '@/components/feedback/FeedbackTicketDetail';
import { FeedbackTicketRail } from '@/components/feedback/FeedbackTicketRail';
import { FEEDBACK_CARD_CLS } from '@/components/feedback/feedbackStyles';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { SUPPORT_TICKET_PARAM } from '@/lib/feedback';
import { cn } from '@/lib/utils';

// Tailwind's `xl` breakpoint, written in the same rem unit so this and the
// page's own responsive classes flip at exactly the same width.
const SPLIT_VIEW_QUERY = '(min-width: 80rem)';
const SKELETON_ROW_COUNT = 4;

const FRAME_CLS = cn(FEEDBACK_CARD_CLS, 'overflow-hidden');

// In split view the frame is pinned to the viewport (less the header,
// breadcrumb, page header, tab bar and page padding stacked above it), so the
// list and the conversation scroll on their own and the reply box stays in view.
const SPLIT_FRAME_CLS =
  'grid h-[calc(100dvh-18.25rem)] min-h-[30rem] grid-cols-[minmax(20rem,26rem)_minmax(0,1fr)] 3xl:h-[calc(100dvh-20.25rem)] 4xl:h-[calc(100dvh-22.25rem)]';

function InboxSkeleton() {
  return (
    <div role="status" aria-label="Loading tickets" className="divide-y divide-stone-100 dark:divide-white/5">
      {Array.from({ length: SKELETON_ROW_COUNT }, (_, i) => (
        <div key={i} className="flex gap-3 px-4 py-4">
          <div className="size-9 shrink-0 rounded-lg bg-stone-100 motion-safe:animate-pulse dark:bg-white/10" />
          <div className="flex-1 space-y-2.5 pt-1">
            <div className="h-3 w-1/3 rounded bg-stone-100 motion-safe:animate-pulse dark:bg-white/10" />
            <div className="h-3 w-5/6 rounded bg-stone-100 motion-safe:animate-pulse dark:bg-white/10" />
          </div>
        </div>
      ))}
    </div>
  );
}

function EmptyInbox({ onCreateTicket }: { onCreateTicket: () => void }) {
  return (
    <div className="flex min-h-[22rem] flex-col items-center justify-center px-6 py-14 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-stone-100 text-stone-400 dark:bg-white/10">
        <Inbox className="size-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-base font-semibold text-stone-900 dark:text-stone-100">No tickets yet</h2>
      <p className="mt-1 max-w-sm text-sm text-stone-500 dark:text-stone-400">
        Found a bug or have an idea? File a ticket and follow the conversation with our team right here.
      </p>
      <Button type="button" className="mt-5" onClick={onCreateTicket}>
        Create your first ticket
      </Button>
    </div>
  );
}

// The My Tickets tab: the reporter's tickets beside the open conversation on
// wide screens, one pane at a time on narrow ones. The open ticket lives in
// `?ticket=` so a reload or a shared link lands on it.
export function FeedbackTicketInbox({ onCreateTicket }: { onCreateTicket: () => void }) {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSplitView = useMediaQuery(SPLIT_VIEW_QUERY);

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

  // Clearing the unread badge is a side effect of the inbox actually being
  // viewed — fires once per mount (the page only mounts this while the My
  // Tickets tab is active), matching the "cleared when they open My Tickets"
  // design.
  useEffect(() => {
    markSeenMutation.mutate();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fire-once-on-mount is deliberate, not a reactive effect
  }, []);

  const tickets = ticketsQ.data?.pages.flatMap((page) => page.tickets) ?? [];
  const chosenId = searchParams.get(SUPPORT_TICKET_PARAM);
  // The right-hand pane should never sit empty while tickets exist, so wide
  // screens fall back to the newest one until the reporter picks another.
  const activeId = chosenId ?? (isSplitView ? tickets[0]?.id : undefined);

  const selectTicket = (ticketId: string | null): void => {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (ticketId) next.set(SUPPORT_TICKET_PARAM, ticketId);
        else next.delete(SUPPORT_TICKET_PARAM);
        return next;
      },
      { replace: true },
    );
  };

  if (ticketsQ.isLoading) {
    return <div className={FRAME_CLS}><InboxSkeleton /></div>;
  }

  // Only when there is nothing to show: a failed "next page" keeps the tickets
  // already loaded on screen.
  if (ticketsQ.isError && tickets.length === 0) {
    return (
      <div className={cn(FRAME_CLS, 'space-y-3 p-6')}>
        <div role="alert">
          <ErrorNote>{apiErrorMessage(ticketsQ.error, 'Failed to load your tickets.')}</ErrorNote>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={() => void ticketsQ.refetch()}>
          Try again
        </Button>
      </div>
    );
  }

  if (tickets.length === 0) {
    return <div className={FRAME_CLS}><EmptyInbox onCreateTicket={onCreateTicket} /></div>;
  }

  const rail = (
    <FeedbackTicketRail
      tickets={tickets}
      selectedId={activeId ?? null}
      onSelect={selectTicket}
      paging={{
        hasNextPage: Boolean(ticketsQ.hasNextPage),
        isFetchingNextPage: ticketsQ.isFetchingNextPage,
        onLoadMore: () => void ticketsQ.fetchNextPage(),
      }}
    />
  );

  if (isSplitView) {
    return (
      <div className={cn(FRAME_CLS, SPLIT_FRAME_CLS)}>
        <div className="flex min-h-0 flex-col border-r border-stone-200 dark:border-white/10">{rail}</div>
        {/* Keyed by ticket so a half-written reply never follows the reporter to another one. */}
        <div className="min-h-0">{activeId && <FeedbackTicketDetail key={activeId} ticketId={activeId} />}</div>
      </div>
    );
  }

  return (
    <div className={FRAME_CLS}>
      {activeId
        ? <FeedbackTicketDetail key={activeId} ticketId={activeId} onBack={() => selectTicket(null)} />
        : rail}
    </div>
  );
}
