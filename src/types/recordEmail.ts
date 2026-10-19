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
  createdAt: string;
}

export interface RecordEmailThread {
  // False when the backend has no inbound reply domain configured: the
  // conversation still lists, but customer replies are not captured.
  enabled: boolean;
  messages: RecordEmailMessage[];
}
