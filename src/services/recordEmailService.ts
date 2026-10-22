import { tenantClient } from '@/api/tenantClient';
import type {
  RecordEmailReplyRequest,
  RecordEmailReplyResult,
  RecordEmailThread,
} from '@/types/recordEmail';

// Record-keyed email conversation endpoints (`/api/tenant/records/{id}/emails`),
// the same shape as documentService's `/document/...` routes: one route serves
// every record type that keeps a thread (today the Sales Order).
export const recordEmailService = {
  // A record's conversation, oldest first. RBAC: <type>:read.
  list: (recordId: string): Promise<RecordEmailThread> =>
    tenantClient
      .get<{
        success: boolean;
        enabled?: boolean;
        replyTo?: string;
        messages?: RecordEmailThread['messages'] | null;
      }>(`/tenant/records/${recordId}/emails`)
      .then((r) => ({
        enabled: r.data.enabled ?? false,
        replyTo: r.data.replyTo ?? '',
        messages: r.data.messages ?? [],
      })),

  // Emails the customer from the Communication tab, or with `internalOnly` only
  // saves a team note on the record (nothing is sent). RBAC: <type>:update.
  reply: (recordId: string, body: RecordEmailReplyRequest): Promise<RecordEmailReplyResult> =>
    tenantClient
      .post<{ success: boolean; emailSent?: boolean; emailError?: string }>(
        `/tenant/records/${recordId}/emails`,
        body,
      )
      .then((r) => ({ emailSent: r.data.emailSent, emailError: r.data.emailError })),
};
