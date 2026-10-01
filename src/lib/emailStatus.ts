import { EMAIL_STATUSES, type EmailStatus } from '@/types/emailStatus';

// What the user reads. "Not sent" is the suppression-list case: the provider
// refused to send because the address is on a list of past bounces/complaints.
export const EMAIL_STATUS_LABEL: Record<Exclude<EmailStatus, 'unknown'>, string> = {
  queued: 'Queued',
  sent: 'Sent',
  retrying: 'Retrying',
  delayed: 'Delayed',
  delivered: 'Delivered',
  complained: 'Marked as spam',
  bounced: 'Bounced',
  failed: 'Failed',
  suppressed: 'Not sent',
  skipped: 'Skipped',
};

// normalizeEmailStatus narrows a wire value to the known vocabulary. Anything
// else — undefined, a typo, a state a newer backend added — is 'unknown', which
// the UI renders as nothing, so an unrecognised value is never shown raw.
export function normalizeEmailStatus(raw: string | undefined): EmailStatus {
  return (EMAIL_STATUSES as readonly string[]).includes(raw ?? '') ? (raw as EmailStatus) : 'unknown';
}
