import { notifyClient } from '@/api/notifyClient';
import type { AppNotification, NotificationHistoryPage } from '@/types/notification';

// Talks to stonesuite-notify directly (not proxied through StoneSuite-Backend
// — see notifyClient). Every response is wrapped in
// `{success, data: {...}}` (models.APIResponse on that service).
export const notificationService = {
  unreadCount: (): Promise<number> =>
    notifyClient
      .get<{ success: boolean; data: { unreadCount: number } }>('/api/notifications/summary')
      .then((r) => r.data.data.unreadCount ?? 0),

  list: (unreadOnly = false, limit?: number): Promise<AppNotification[]> =>
    notifyClient
      .get<{ success: boolean; data: { notifications: AppNotification[] } }>('/api/notifications', {
        params: { unreadOnly: unreadOnly || undefined, limit },
      })
      .then((r) => r.data.data.notifications ?? []),

  history: (page: number, pageSize: number, unreadOnly = false): Promise<NotificationHistoryPage> =>
    notifyClient
      .get<{ success: boolean; data: NotificationHistoryPage }>('/api/notifications/history', {
        params: { page, pageSize, unreadOnly: unreadOnly || undefined },
      })
      .then((r) => ({
        notifications: r.data.data.notifications ?? [],
        pagination: r.data.data.pagination,
      })),

  markRead: (id: string): Promise<void> =>
    notifyClient.post(`/api/notifications/${id}/read`).then(() => undefined),

  markAllRead: (): Promise<void> =>
    notifyClient.post('/api/notifications/read-all').then(() => undefined),
};
