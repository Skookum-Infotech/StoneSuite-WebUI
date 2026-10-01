// The real outcome of an email, as the backend reports it on any row that
// triggered one. Mirrors the backend's services.EmailSummary JSON
// (emailStatus…). Every field is optional: an older backend, a row that
// predates delivery tracking, and a notification-service outage all omit them,
// and the UI renders nothing in that case.
export const EMAIL_STATUSES = [
  'queued',
  'sent',
  'retrying',
  'delayed',
  'delivered',
  'complained',
  'bounced',
  'failed',
  'suppressed',
  'skipped',
  'unknown',
] as const;

export type EmailStatus = (typeof EMAIL_STATUSES)[number];

export interface EmailRecipientStatus {
  email: string;
  status: EmailStatus;
}

export interface EmailStatusFields {
  emailStatus?: EmailStatus;
  emailStatusAt?: string;
  // Client-safe sentence; present for problem states, absent for sent/delivered.
  emailStatusMessage?: string;
  emailRecipients?: EmailRecipientStatus[];
}
