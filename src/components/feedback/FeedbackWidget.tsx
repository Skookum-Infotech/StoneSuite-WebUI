import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquarePlus } from 'lucide-react';
import { feedbackService } from '@/services/feedbackService';
import { FeedbackPanel } from '@/components/feedback/FeedbackPanel';
import { useAuthStore } from '@/store/useAuthStore';

// Poll interval for the unread badge — cheap enough to run continuously
// while a session is open, and gives an admin's reply a reasonably prompt
// notification without a websocket.
const UNREAD_POLL_MS = 60_000;

// Header icon (next to the notification bell) for reporting a bug/feature
// request/etc. Rendered for BOTH tenant staff and customer-portal users —
// MainLayout mounts this unconditionally, same as the bell.
export function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const unreadQ = useQuery({
    queryKey: ['feedback-unread-count'],
    queryFn: feedbackService.unreadCount,
    enabled: isAuthenticated,
    refetchInterval: UNREAD_POLL_MS,
    staleTime: UNREAD_POLL_MS,
  });
  const unreadCount = unreadQ.data ?? 0;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unreadCount > 0 ? `Feedback (${unreadCount} unread)` : 'Feedback'}
        className="relative rounded-xl border border-white/10 p-2 text-stone-400 hover:bg-white/[0.06] hover:text-stone-200 transition-colors cursor-pointer"
      >
        <MessageSquarePlus className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 flex h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />
        )}
      </button>
      {open && <FeedbackPanel onClose={() => setOpen(false)} />}
    </>
  );
}
