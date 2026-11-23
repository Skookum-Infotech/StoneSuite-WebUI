// One email in a record's conversation (GET /tenant/records/{id}/emails). Bodies
// are plain text: the backend strips a reply's quoted history and keeps no HTML.
export type RecordEmailDirection = 'in' | 'out';

// Where a file on a message stands. 'stored' can be downloaded; 'pending' is a
// received file still being copied; the rest were deliberately or unavoidably
// not kept (too large, a program-like type, or storage was not available).
export type RecordEmailAttachmentStatus = 'pending' | 'stored' | 'too_large' | 'blocked' | 'unavailable';

// One file that travelled with a message: received on a reply, or attached by
// staff when replying.
export interface RecordEmailAttachment {
  id: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  // Shown inside the mail body (a pasted picture, a signature logo), not attached.
  inline: boolean;
  status: RecordEmailAttachmentStatus;
}

export interface RecordEmailMessage {
  id: string;
  recordId: string;
  workflowKey: string;
  // 'out' is mail StoneSuite sent; 'in' is the other party's reply.
  direction: RecordEmailDirection;
  fromName: string;
  fromEmail: string;
  // Comma-separated recipient lists, as stored.
  to: string;
  cc: string;
  subject: string;
  body: string;
  // How many files the mail had. A message from before files were kept has a count
  // but no entries in `attachments`.
  attachmentCount: number;
  attachments: RecordEmailAttachment[];
  // A team-only note typed with "Internal only" on: kept on the record, never
  // emailed (so it has no recipient or subject).
  internal: boolean;
  createdAt: string;
}

// Who is on the other end of a record's Communication tab: the customer a sales
// document goes to, the vendor a purchase order goes to, or nobody ('internal':
// a team-notes timeline with no email at all, as on a requisition).
export type CommunicationAudience = 'customer' | 'vendor' | 'internal';

export interface RecordEmailThread {
  // False when the backend has no inbound reply domain configured: the
  // conversation still lists, but the other party's replies are not captured.
  enabled: boolean;
  // Files can be attached to a message and downloaded: the workspace has file
  // storage. Independent of `enabled`, since a note can carry files too.
  attachmentsEnabled: boolean;
  // The address a reply would go to; '' until an email has been sent.
  replyTo: string;
  // Oldest first, the order the tab shows.
  messages: RecordEmailMessage[];
}

// POST /tenant/records/{id}/emails: an emailed reply, or with internalOnly a
// note that is only saved on the record.
export interface RecordEmailReplyRequest {
  message: string;
  internalOnly: boolean;
  // Files to send with it (or, on a note, to keep with it).
  files?: File[];
}

export interface RecordEmailAttachmentDownload {
  downloadUrl: string;
  fileName: string;
}

export interface RecordEmailReplyResult {
  // False when the reply was saved to the conversation but the email did not go
  // out; absent for a note, which sends nothing.
  emailSent?: boolean;
  // Client-safe explanation, present only when emailSent is false.
  emailError?: string;
}
