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
