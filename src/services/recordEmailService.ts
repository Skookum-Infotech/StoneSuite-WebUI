import { tenantClient } from '@/api/tenantClient';
import type {
  RecordEmailAttachmentDownload,
  RecordEmailMessage,
  RecordEmailReplyRequest,
  RecordEmailReplyResult,
  RecordEmailThread,
} from '@/types/recordEmail';

// A reply with files goes as multipart/form-data. apiClient's default JSON
// Content-Type would make axios serialize the FormData to JSON, so the request
// overrides it (the browser then adds the boundary).
const MULTIPART_HEADERS = { 'Content-Type': 'multipart/form-data' };

type ReplyResponse = { success: boolean; emailSent?: boolean; emailError?: string };

function replyForm(message: string, internalOnly: boolean, files: File[]): FormData {
  const form = new FormData();
  form.append('message', message);
  form.append('internalOnly', String(internalOnly));
  files.forEach((file) => form.append('files', file));
  return form;
}

type RawMessage = Omit<RecordEmailMessage, 'attachments'> & { attachments?: RecordEmailMessage['attachments'] | null };

// Record-keyed email conversation endpoints (`/api/tenant/records/{id}/emails`),
// the same shape as documentService's `/document/...` routes: one route serves
// every record type that keeps a thread.
export const recordEmailService = {
  // A record's conversation, oldest first. RBAC: <type>:read.
  list: (recordId: string): Promise<RecordEmailThread> =>
    tenantClient
      .get<{
        success: boolean;
        enabled?: boolean;
        attachmentsEnabled?: boolean;
        replyTo?: string;
        messages?: RawMessage[] | null;
      }>(`/tenant/records/${recordId}/emails`)
      .then((r) => ({
        enabled: r.data.enabled ?? false,
        attachmentsEnabled: r.data.attachmentsEnabled ?? false,
        replyTo: r.data.replyTo ?? '',
        messages: (r.data.messages ?? []).map((m) => ({ ...m, attachments: m.attachments ?? [] })),
      })),

  // Emails the other party from the Communication tab, or with `internalOnly` only
  // saves a team note on the record (nothing is sent). Files go along as
  // multipart/form-data. RBAC: <type>:update.
  reply: (recordId: string, { message, internalOnly, files = [] }: RecordEmailReplyRequest): Promise<RecordEmailReplyResult> => {
    const url = `/tenant/records/${recordId}/emails`;
    const request =
      files.length === 0
        ? tenantClient.post<ReplyResponse>(url, { message, internalOnly })
        : tenantClient.post<ReplyResponse>(url, replyForm(message, internalOnly, files), { headers: MULTIPART_HEADERS });
    return request.then((r) => ({ emailSent: r.data.emailSent, emailError: r.data.emailError }));
  },

  // A short-lived link to one file of the conversation, which forces a download.
  // RBAC: <type>:read.
  downloadAttachment: (recordId: string, attachmentId: string): Promise<RecordEmailAttachmentDownload> =>
    tenantClient
      .get<{ success: boolean; downloadUrl: string; fileName: string }>(
        `/tenant/records/${recordId}/emails/attachments/${attachmentId}/download`,
      )
      .then((r) => ({ downloadUrl: r.data.downloadUrl, fileName: r.data.fileName })),
};
