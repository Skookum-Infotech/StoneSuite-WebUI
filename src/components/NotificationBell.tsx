import { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck } from 'lucide-react';
import { notificationService } from '@/services/notificationService';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';

// Poll interval for the unread badge — same cadence as HelpMenu's own
// unread-reply poll, cheap enough to run continuously while a session is
// open.
const UNREAD_POLL_MS = 60_000;
const LIST_LIMIT = 10;

const SUMMARY_KEY = ['notifications-summary'];
const LIST_KEY = ['notifications-list'];

// Durable notification history (owner/approver pings, etc. — see
// approvalchain/notify.go on the backend) surfaced via stonesuite-notify.
// This is deliberately separate from the toast confirmations shown right
// after an action (see SendToCustomerDialog): a toast is for "you're still
// looking at the screen, here's instant feedback"; this bell is for "what
// happened while I wasn't looking, and can I still find it later".
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isCustomer = useAuthStore((s) => s.kind === 'portal');
  const queryClient = useQueryClient();

  // Customer-portal sessions have no StoneSuite users.id behind them for
  // most flows (see docs/superpowers/specs/2026-08-28-notify-customer-...
  // -design.md D1/D2) -- stonesuite-notify's user-facing API requires a real
  // recipientUserId, so there is nothing this bell could ever show a
  // customer. Hide it there rather than polling for an always-empty list.
  const enabled = isAuthenticated && !isCustomer;

  const summaryQ = useQuery({
    queryKey: SUMMARY_KEY,
    queryFn: notificationService.unreadCount,
    enabled,
    refetchInterval: UNREAD_POLL_MS,
    staleTime: UNREAD_POLL_MS,
  });
  const unreadCount = summaryQ.data ?? 0;

  const listQ = useQuery({
    queryKey: LIST_KEY,
    queryFn: () => notificationService.list(false, LIST_LIMIT),
    enabled: enabled && open,
    refetchInterval: UNREAD_POLL_MS,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationService.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });

  const markAllRead = useMutation({
    mutationFn: () => notificationService.markAllRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: SUMMARY_KEY });
      queryClient.invalidateQueries({ queryKey: LIST_KEY });
    },
  });

  // Same click-outside/Escape-closes convention as HelpMenu and MainLayout's
  // own profile menu.
  useEffect(() => {
    if (!open) return;
    const close = (): void => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  if (!enabled) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : 'Notifications'}
        aria-haspopup="menu"
        aria-expanded={open}
        className="relative rounded-xl border border-white/10 p-2 text-stone-400 hover:bg-white/[0.06] hover:text-stone-200 transition-colors cursor-pointer"
      >
        <Bell className="size-4.5" />
        {unreadCount > 0 && (
          <span className="absolute right-2 top-2 flex h-1.5 w-1.5 rounded-full bg-destructive" aria-hidden="true" />
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className={cn(
            'fixed inset-x-4 top-16 z-30 origin-top rounded-2xl border border-white/10 bg-[#1c1c1c] p-2 shadow-2xl ring-1 ring-white/[0.04] animate-in fade-in slide-in-from-top-1 duration-150',
            'sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2.5 sm:w-80 sm:origin-top-right',
          )}
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <span className="text-xs font-bold text-stone-200">Notifications</span>
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); markAllRead.mutate(); }}
                disabled={markAllRead.isPending}
                className="flex items-center gap-1 rounded-lg px-2 py-1 text-2xs font-medium text-stone-400 hover:bg-white/[0.06] hover:text-stone-200 disabled:opacity-50 cursor-pointer"
              >
                <CheckCheck className="size-3" />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {listQ.isLoading && (
              <p className="px-3 py-4 text-center text-2xs text-stone-500">Loading…</p>
            )}
            {listQ.isError && !listQ.data && (
              <p className="px-3 py-4 text-center text-2xs text-stone-500">Couldn't load notifications.</p>
            )}
            {listQ.data?.length === 0 && (
              <p className="px-3 py-4 text-center text-2xs text-stone-500">You're all caught up.</p>
            )}
            {listQ.data?.map((n) => (
              <button
                key={n.id}
                type="button"
                role="menuitem"
                onClick={(e) => {
                  e.stopPropagation();
                  if (!n.readAt) markRead.mutate(n.id);
                }}
                className={cn(
                  'flex w-full items-start gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-white/[0.06] cursor-pointer',
                  !n.readAt && 'bg-white/[0.03]',
                )}
              >
                {!n.readAt && (
                  <span className="mt-1.5 flex size-1.5 shrink-0 rounded-full bg-brand" aria-hidden="true" />
                )}
                <span className={cn('flex-1', n.readAt && 'pl-4')}>
                  <span className="block text-xs font-semibold text-stone-200">{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-2xs text-stone-500">{n.body}</span>}
                  <span className="mt-1 block text-2xs text-stone-600">{timeAgo(n.createdAt)}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Short relative-time label ("just now" / "5m ago" / "3h ago" / "2d ago") —
// the dropdown is a "what's recent" feed, not a full timestamp display, so a
// coarse label is all it needs.
function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
