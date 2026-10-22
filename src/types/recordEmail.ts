// One email in a record's conversation (GET /tenant/records/{id}/emails). Bodies
// are plain text: the backend strips a reply's quoted history and keeps no HTML.
export type RecordEmailDirection = 'in' | 'out';

export interface RecordEmailMessage {
  id: string;
  recordId: string;
  workflowKey: string;
  // 'out' is mail StoneSuite sent; 'in' is a customer's reply.
  direction: RecordEmailDirection;
  fromName: string;
  fromEmail: string;
  // Comma-separated recipient lists, as stored.
  to: string;
  cc: string;
  subject: string;
  body: string;
  // Attachments are not stored yet; this only says how many the mail had.
  attachmentCount: number;
  // A team-only note typed with "Internal only" on: kept on the record, never
  // emailed (so it has no recipient or subject).
  internal: boolean;
  createdAt: string;
}

export interface RecordEmailThread {
  // False when the backend has no inbound reply domain configured: the
  // conversation still lists, but customer replies are not captured.
  enabled: boolean;
  // The customer address a reply would go to; '' until an email has been sent.
  replyTo: string;
  // Oldest first, the order the tab shows.
  messages: RecordEmailMessage[];
}

// POST /tenant/records/{id}/emails: an emailed reply, or with internalOnly a
// note that is only saved on the record.
export interface RecordEmailReplyRequest {
  message: string;
  internalOnly: boolean;
}

export interface RecordEmailReplyResult {
  // False when the reply was saved to the conversation but the email did not go
  // out; absent for a note, which sends nothing.
  emailSent?: boolean;
  // Client-safe explanation, present only when emailSent is false.
  emailError?: string;
}
