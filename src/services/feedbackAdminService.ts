import { tenantClient } from '@/api/tenantClient';
import type {
  FeedbackAdminFilters,
  FeedbackAdminPatch,
  FeedbackComment,
  FeedbackStats,
  FeedbackTicket,
  FeedbackTicketDetail,
  FeedbackTicketPage,
} from '@/types/feedback';

// Platform-admin feedback ticket API — the cross-tenant "Support Tickets"
// list/detail, status/priority/assignment changes, replies, and attachment
// downloads. Served from /api/platform/feedback*, gated server-side on
// platform-admin (not a tenant-scoped RBAC resource) rather than RBAC — same
// convention tenantServices.ts uses for the other /platform/* calls.
const BASE = '/platform/feedback';

export const feedbackAdminService = {
  list: (filters: FeedbackAdminFilters): Promise<FeedbackTicketPage> =>
    tenantClient
      .get<{ success: boolean; tickets: FeedbackTicket[]; nextCursor: string }>(BASE, {
        params: {
          status: filters.status || undefined,
          category: filters.category || undefined,
          priority: filters.priority || undefined,
          tenantId: filters.tenantId || undefined,
          search: filters.search || undefined,
          cursor: filters.cursor || undefined,
          limit: filters.limit,
        },
      })
      .then((r) => ({ tickets: r.data.tickets ?? [], nextCursor: r.data.nextCursor ?? '' })),

  stats: (): Promise<FeedbackStats> =>
    tenantClient
      .get<{ success: boolean; stats: FeedbackStats }>(`${BASE}/stats`)
      .then((r) => r.data.stats),

  get: (id: string): Promise<FeedbackTicketDetail> =>
    tenantClient
      .get<{ success: boolean } & FeedbackTicketDetail>(`${BASE}/${id}`)
      .then((r) => ({ ticket: r.data.ticket, comments: r.data.comments ?? [], attachments: r.data.attachments ?? [] })),

  patch: (id: string, patch: FeedbackAdminPatch): Promise<FeedbackTicket> =>
    tenantClient
      .patch<{ success: boolean; ticket: FeedbackTicket }>(`${BASE}/${id}`, patch)
      .then((r) => r.data.ticket),

  addComment: (id: string, body: string, isInternal: boolean): Promise<FeedbackComment> =>
    tenantClient
      .post<{ success: boolean; comment: FeedbackComment }>(`${BASE}/${id}/comments`, { body, isInternal })
      .then((r) => r.data.comment),

  downloadAttachment: (id: string, attachmentId: string): Promise<{ downloadUrl: string; fileName: string }> =>
    tenantClient
      .get<{ success: boolean; downloadUrl: string; fileName: string }>(`${BASE}/${id}/attachments/${attachmentId}/download`)
      .then((r) => ({ downloadUrl: r.data.downloadUrl, fileName: r.data.fileName })),
};
