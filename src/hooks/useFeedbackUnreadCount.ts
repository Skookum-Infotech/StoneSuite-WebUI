import { useQuery } from '@tanstack/react-query';
import { feedbackService } from '@/services/feedbackService';
import { useAuthStore } from '@/store/useAuthStore';

// Poll interval for the unread-reply badge — cheap enough to run continuously
// while a session is open, and gives an admin's reply a reasonably prompt
// notification without a websocket.
const UNREAD_POLL_MS = 60_000;

// How many of the signed-in user's own tickets have replies they haven't seen.
// Shared by the Help menu's dot/count and the sidebar's My Tickets badge: both
// stay mounted for the whole session and read the same query-cache entry, so
// it is fetched once per poll. FeedbackTicketInbox clears it (mark-seen) when
// the reporter opens their tickets.
export function useFeedbackUnreadCount(): number {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const unreadQ = useQuery({
    queryKey: ['feedback-unread-count'],
    queryFn: feedbackService.unreadCount,
    enabled: isAuthenticated,
    refetchInterval: UNREAD_POLL_MS,
    staleTime: UNREAD_POLL_MS,
  });

  return unreadQ.data ?? 0;
}
