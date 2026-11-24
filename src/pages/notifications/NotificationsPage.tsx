import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, CheckCheck, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { notificationService } from '@/services/notificationService';
import { apiErrorMessage } from '@/api/tenantClient';
import { cn } from '@/lib/utils';
import {
  NOTIFICATION_HISTORY_KEY,
  NOTIFICATION_LIST_KEY,
  NOTIFICATION_SUMMARY_KEY,
} from '@/lib/notificationKeys';
import { formatNotificationTime, notificationRecordLabel } from '@/lib/notificationRecord';
import type { AppNotification } from '@/types/notification';

const PAGE_SIZE = 20;
const SKELETON_ROWS = [0, 1, 2, 3];
const NAV_BTN =
  'flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-ink hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors';

type Filter = 'all' | 'unread';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'unread', label: 'Unread' },
];

// The full notification history: everything the bell shows, plus what scrolled out of it. Each row
// carries its title, message, related record, date and time and read state, and opens the record.
export default function NotificationsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<Filter>('all');
  const [page, setPage] = useState(1);

  const historyQ = useQuery({
    queryKey: [...NOTIFICATION_HISTORY_KEY, filter, page],
    queryFn: () => notificationService.history(page, PAGE_SIZE, filter === 'unread'),
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: true,
    retry: false,
  });

  const refreshAll = (): void => {
    void queryClient.invalidateQueries({ queryKey: NOTIFICATION_HISTORY_KEY });
    void queryClient.invalidateQueries({ queryKey: NOTIFICATION_SUMMARY_KEY });
    void queryClient.invalidateQueries({ queryKey: NOTIFICATION_LIST_KEY });
  };

  const markRead = useMutation({ mutationFn: (id: string) => notificationService.markRead(id), onSuccess: refreshAll });
  const markAllRead = useMutation({ mutationFn: () => notificationService.markAllRead(), onSuccess: refreshAll });

  const data = historyQ.data;
  const items = data?.notifications ?? [];
  const totalPages = data?.pagination.totalPages ?? 0;
  const hasUnread = items.some((n) => !n.readAt) || filter === 'unread';
  const isEmpty = !historyQ.isLoading && !historyQ.isError && items.length === 0;

  function chooseFilter(next: Filter): void {
    setFilter(next);
    setPage(1);
  }

  function open(n: AppNotification): void {
    if (!n.readAt) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col p-4 sm:p-6 3xl:p-10 4xl:p-14">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10">
          <Bell className="size-5 text-accent-foreground" aria-hidden="true" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="type-page-title">Notifications</h1>
          <p className="type-page-subtitle">Everything sent to you in StoneSuite, newest first.</p>
        </div>
        {hasUnread && (
          <button type="button" onClick={() => markAllRead.mutate()} disabled={markAllRead.isPending} className={NAV_BTN}>
            <CheckCheck className="size-3.5" aria-hidden="true" />
            Mark all read
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-col gap-3 border-t border-stone-100 pt-4">
        <div role="tablist" aria-label="Filter notifications" className="flex gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => chooseFilter(f.key)}
              className={cn(
                'h-8 rounded-lg px-3 text-xs font-medium transition-colors',
                filter === f.key ? 'bg-stone-900 text-white' : 'border border-stone-200 bg-white text-ink hover:bg-stone-50',
              )}
            >
              {f.label}
            </button>
          ))}
        </div>

        {historyQ.isLoading && (
          <div role="status" aria-label="Loading notifications" className="flex flex-col gap-2">
            <span className="sr-only">Loading notifications…</span>
            {SKELETON_ROWS.map((i) => (
              <div key={i} aria-hidden="true" className="h-16 animate-pulse rounded-xl bg-stone-100" />
            ))}
          </div>
        )}

        {historyQ.isError && (
          <div role="alert" className="flex items-center gap-3 text-sm text-danger-ink">
            <span>{apiErrorMessage(historyQ.error, 'Failed to load notifications.')}</span>
            <button type="button" onClick={() => void historyQ.refetch()} className={NAV_BTN}>
              Retry
            </button>
          </div>
        )}

        {isEmpty && (
          <p className="rounded-xl border border-dashed border-stone-200 px-4 py-10 text-center text-sm text-ink-muted">
            {filter === 'unread' ? 'You have no unread notifications.' : 'No notifications yet.'}
          </p>
        )}

        {items.length > 0 && (
          <ul aria-label="Notifications" className="flex flex-col divide-y divide-stone-100 rounded-xl border border-stone-200 bg-white">
            {items.map((n) => (
              <li key={n.id} className={cn('flex items-start gap-3 px-4 py-3', !n.readAt && 'bg-stone-50')}>
                <span
                  className={cn('mt-2 size-2 shrink-0 rounded-full', n.readAt ? 'bg-transparent' : 'bg-brand')}
                  role="img"
                  aria-label={n.readAt ? 'Read' : 'Unread'}
                />
                <div className="min-w-0 flex-1">
                  <p className={cn('text-sm text-ink-strong', n.readAt ? 'font-medium' : 'font-bold')}>{n.title}</p>
                  {n.body && <p className="mt-0.5 text-sm text-ink">{n.body}</p>}
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 type-helper">
                    <span className="rounded-md bg-stone-100 px-1.5 py-0.5 font-medium text-ink">
                      {notificationRecordLabel(n.resource)}
                    </span>
                    <time dateTime={n.createdAt}>{formatNotificationTime(n.createdAt)}</time>
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  {n.link && (
                    <button type="button" onClick={() => open(n)} className={NAV_BTN} aria-label={`Open ${n.title}`}>
                      <ExternalLink className="size-3.5" aria-hidden="true" />
                      Open
                    </button>
                  )}
                  {!n.readAt && (
                    <button
                      type="button"
                      onClick={() => markRead.mutate(n.id)}
                      disabled={markRead.isPending}
                      className={NAV_BTN}
                      aria-label={`Mark ${n.title} as read`}
                    >
                      Mark read
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-1">
            <p className="tabular-nums type-helper">
              Page {page} of {totalPages}
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => setPage((p) => p - 1)} disabled={page <= 1} aria-label="Previous page" className={NAV_BTN}>
                <ChevronLeft className="size-3.5" aria-hidden="true" />
                Previous
              </button>
              <button type="button" onClick={() => setPage((p) => p + 1)} disabled={page >= totalPages} aria-label="Next page" className={NAV_BTN}>
                Next
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
