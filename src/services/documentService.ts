import { tenantClient } from '@/api/tenantClient';
import type { EmailStatusFields } from '@/types/emailStatus';

export interface DocumentSendPayload {
  to?: string[];
  cc?: string[];
  subject?: string;
  message?: string;
}

export interface DocumentSendResult {
  sendId: string;
  sentTo: string[];
  // What really happened to the email. The backend confirms the first delivery
  // attempt before answering, so `false` is a real failure — the send is
  // recorded, but the email did not go out. Absent only from older backends.
  emailSent?: boolean;
  // Client-safe explanation, present only when emailSent is false.
  emailError?: string;
}

// One row of a record's email history (GET …/document/sends). The email status
// fields report what the provider says happened to the email, not just that we
// handed it over; they are absent for sends that predate delivery tracking.
export interface DocumentSendRecord extends EmailStatusFields {
  id: string;
  recordId: string;
  workflowKey: string;
  // Comma-separated recipient list, as stored.
  sentTo: string;
  cc?: string;
  subject?: string;
  sentAt: string;
}

// Generic record-keyed document endpoints (`/api/tenant/records/{id}/...`),
// mirroring attachmentService's shape — these aren't scoped under any one
// module's own `/tenant/<module>*` base, since the backend wires the same
// route across every document type with a printable-doc loader (sales_order,
// invoice, quote, estimate).
export const documentService = {
  // Renders the record to PDF and emails it — defaults `to` to the record's
  // billing email server-side if omitted. RBAC: <type>:update.
  sendToCustomer: (recordId: string, payload: DocumentSendPayload = {}): Promise<DocumentSendResult> =>
    tenantClient
      .post<{ success: boolean } & DocumentSendResult>(
        `/tenant/records/${recordId}/document/send`,
        payload,
      )
      .then((r) => ({
        sendId: r.data.sendId,
        sentTo: r.data.sentTo,
        emailSent: r.data.emailSent,
        emailError: r.data.emailError,
      })),

  // A record's email history, newest first. RBAC: <type>:read.
  listSends: (recordId: string): Promise<DocumentSendRecord[]> =>
    tenantClient
      .get<{ success: boolean; sends?: DocumentSendRecord[] | null }>(`/tenant/records/${recordId}/document/sends`)
      .then((r) => r.data.sends ?? []),
};
