import { tenantClient } from '@/api/tenantClient';
import { isPortalSession } from '@/store/useAuthStore';
import type {
  FeedbackAttachment,
  FeedbackComment,
  FeedbackConfirmAttachmentIn,
  FeedbackPresignFileIn,
  FeedbackPresignFileOut,
  FeedbackSubmitInput,
  FeedbackTicket,
  FeedbackTicketDetail,
  FeedbackTicketPage,
} from '@/types/feedback';

// Reporter-facing feedback ticket API — filing a ticket, tracking "My
// Tickets", replying, and attaching files. Registered under BOTH
// /api/tenant/feedback* (staff) and /api/portal/feedback* (customer-portal
// users) with identical shapes, so every call here branches its base path on
// session kind exactly like invoiceService/paymentService do — the backend
// confines a portal token to /api/portal/* regardless, so there is nothing
// else to branch on.
const BASE = '/tenant/feedback';
const PORTAL_BASE = '/portal/feedback';

function base(): string {
  return isPortalSession() ? PORTAL_BASE : BASE;
}

export const feedbackService = {
  submit: (input: FeedbackSubmitInput): Promise<FeedbackTicket> =>
    tenantClient
      .post<{ success: boolean; ticket: FeedbackTicket }>(base(), input)
      .then((r) => r.data.ticket),

  listMine: (cursor = '', limit?: number): Promise<FeedbackTicketPage> =>
    tenantClient
      .get<{ success: boolean; tickets: FeedbackTicket[]; nextCursor: string }>(base(), {
        params: { cursor: cursor || undefined, limit },
      })
      .then((r) => ({ tickets: r.data.tickets ?? [], nextCursor: r.data.nextCursor ?? '' })),

  getMine: (id: string): Promise<FeedbackTicketDetail> =>
    tenantClient
      .get<{ success: boolean } & FeedbackTicketDetail>(`${base()}/${id}`)
      .then((r) => ({ ticket: r.data.ticket, comments: r.data.comments ?? [], attachments: r.data.attachments ?? [] })),

  addComment: (id: string, body: string): Promise<FeedbackComment> =>
    tenantClient
      .post<{ success: boolean; comment: FeedbackComment }>(`${base()}/${id}/comments`, { body })
      .then((r) => r.data.comment),

  unreadCount: (): Promise<number> =>
    tenantClient
      .get<{ success: boolean; unreadCount: number }>(`${base()}/unread-count`)
      .then((r) => r.data.unreadCount ?? 0),

  /** Clears the unread badge for every one of the caller's own tickets — call
   *  when the "My Tickets" tab opens. */
  markSeen: (): Promise<void> => tenantClient.post(`${base()}/mark-seen`, {}).then(() => undefined),

  presignAttachments: (id: string, files: FeedbackPresignFileIn[]): Promise<FeedbackPresignFileOut[]> =>
    tenantClient
      .post<{ success: boolean; files: FeedbackPresignFileOut[] }>(`${base()}/${id}/attachments/presign`, { files })
      .then((r) => r.data.files),

  confirmAttachments: (id: string, attachments: FeedbackConfirmAttachmentIn[]): Promise<FeedbackAttachment[]> =>
    tenantClient
      .post<{ success: boolean; attachments: FeedbackAttachment[] }>(`${base()}/${id}/attachments`, { attachments })
      .then((r) => r.data.attachments ?? []),

  downloadAttachment: (id: string, attachmentId: string): Promise<{ downloadUrl: string; fileName: string }> =>
    tenantClient
      .get<{ success: boolean; downloadUrl: string; fileName: string }>(`${base()}/${id}/attachments/${attachmentId}/download`)
      .then((r) => ({ downloadUrl: r.data.downloadUrl, fileName: r.data.fileName })),
};
