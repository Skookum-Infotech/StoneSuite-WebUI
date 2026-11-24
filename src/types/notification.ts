// Mirrors stonesuite-notify's notifications.Notification (see
// stonesuite-notify/notifications/types.go) — the sibling service's own
// wire shape, not something derived from StoneSuite-Backend.
export interface AppNotification {
  id: string;
  tenantId: string;
  recipientUserId: string;
  actorUserId?: string;
  eventType: string;
  resource: string;
  resourceId: string;
  title: string;
  body?: string;
  link?: string;
  visibleInApp: boolean;
  readAt?: string;
  createdAt: string;
}

/** Paging block of Notify's `/api/notifications/history`. */
export interface NotificationPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

/** One page of the full notification history. */
export interface NotificationHistoryPage {
  notifications: AppNotification[];
  pagination: NotificationPagination;
}
