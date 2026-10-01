import { EMAIL_STATUSES, type EmailStatus, type EmailStatusFields } from '@/types/emailStatus';

type KnownEmailStatus = Exclude<EmailStatus, 'unknown'>;

// What the user reads. The labels answer one question, "did the email reach
// them?", in plain words. "Sent" is deliberately not one of them: the provider
// reports `sent` as soon as it has taken the email, which is long before it is
// in anyone's inbox, and "Sent" read as "done". A state that is still open says
// so ("Awaiting delivery"); a state that ended badly says what happened to the
// email, not the mail-server term for it.
export const EMAIL_STATUS_LABEL: Record<KnownEmailStatus, string> = {
  queued: 'Queued',
  sent: 'Awaiting delivery',
  retrying: 'Retrying',
  delayed: 'Delayed',
  delivered: 'Delivered',
  complained: 'Marked as spam',
  bounced: 'Not delivered',
  failed: 'Failed to send',
  suppressed: 'Blocked address',
  skipped: 'Not sent',
};

// One sentence on what each state means, for the states where the backend sends
// no message of its own (it explains problems; it says nothing about the happy
// path). The two still-open states are the ones that need it most: without it
// the badge is a bare word that looks like the end of the story.
export const EMAIL_STATUS_HINT: Partial<Record<KnownEmailStatus, string>> = {
  queued: 'Waiting to be handed to the mail server.',
  sent: 'Handed to the recipient’s mail server. Delivery isn’t confirmed yet; this updates once it is.',
  delivered: 'The recipient’s mail server accepted it.',
};

// States whose hint is worth printing on the page (not just in a tooltip): the
// ones that are still open. A delivered email needs no paragraph.
const OPEN_STATES: ReadonlySet<EmailStatus> = new Set(['queued', 'sent']);

// normalizeEmailStatus narrows a wire value to the known vocabulary. Anything
// else — undefined, a typo, a state a newer backend added — is 'unknown', which
// the UI renders as nothing, so an unrecognised value is never shown raw.
export function normalizeEmailStatus(raw: string | undefined): EmailStatus {
  return (EMAIL_STATUSES as readonly string[]).includes(raw ?? '') ? (raw as EmailStatus) : 'unknown';
}

// emailStatusExplanation is the sentence to show under a status: the backend's
// own message when it sent one (every problem state), else the plain-words hint
// for a state that is still open. Undefined when there is nothing to add.
export function emailStatusExplanation(source: EmailStatusFields): string | undefined {
  const status = normalizeEmailStatus(source.emailStatus);
  if (status === 'unknown') return undefined;
  if (source.emailStatusMessage) return source.emailStatusMessage;
  return OPEN_STATES.has(status) ? EMAIL_STATUS_HINT[status] : undefined;
}
