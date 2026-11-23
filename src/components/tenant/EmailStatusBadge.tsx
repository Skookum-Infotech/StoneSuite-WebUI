import { AlertTriangle, Ban, Clock, Mail, MailCheck, MailMinus, MailX, RefreshCw, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EMAIL_STATUS_LABEL, emailStatusExplanation, normalizeEmailStatus } from '@/lib/emailStatus';
import type { EmailStatus, EmailStatusFields } from '@/types/emailStatus';

type Tone = 'ok' | 'progress' | 'warn' | 'bad';

// Colour reinforces the label and icon; it is never the only signal.
const TONE_CLASS: Record<Tone, string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  progress: 'border-stone-200 bg-stone-100 text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300',
  warn: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  bad: 'border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
};

// Envelope icons throughout: the badge sits next to other statuses (an invite's
// "Pending", an access grant's "Active"), and the envelope is what says this
// one is about the email itself.
const VISUAL: Record<Exclude<EmailStatus, 'unknown'>, { tone: Tone; icon: LucideIcon }> = {
  queued: { tone: 'progress', icon: Clock },
  sent: { tone: 'progress', icon: Mail },
  retrying: { tone: 'warn', icon: RefreshCw },
  delayed: { tone: 'warn', icon: Clock },
  delivered: { tone: 'ok', icon: MailCheck },
  complained: { tone: 'bad', icon: AlertTriangle },
  bounced: { tone: 'bad', icon: MailX },
  failed: { tone: 'bad', icon: MailX },
  suppressed: { tone: 'bad', icon: Ban },
  skipped: { tone: 'progress', icon: MailMinus },
};

const UNKNOWN_LABEL = 'Unknown';

function labelOf(status: EmailStatus): string {
  return status === 'unknown' ? UNKNOWN_LABEL : EMAIL_STATUS_LABEL[status];
}

interface EmailStatusBadgeProps {
  source: EmailStatusFields;
  // Print the explanation (the backend's message, or a plain-words hint for a
  // still-open state) as text under the badge. Use it in detail views; leave it
  // off in compact list rows (the tooltip still has it).
  showMessage?: boolean;
}

// EmailStatusBadge shows what happened to an email a user sent: awaiting
// delivery, delivered, or a problem (not delivered, delayed, …). Renders
// nothing when the row carries no usable status, so legacy rows and a
// notification-service outage look like "no information", not like an error.
export function EmailStatusBadge({ source, showMessage = false }: EmailStatusBadgeProps) {
  const status = normalizeEmailStatus(source.emailStatus);
  if (status === 'unknown') return null;

  const { tone, icon: Icon } = VISUAL[status];
  const explanation = emailStatusExplanation(source);
  const recipients = source.emailRecipients ?? [];

  // The tooltip adds detail; it is never the only place a message appears.
  const tooltipLines = [
    `Email: ${EMAIL_STATUS_LABEL[status]}`,
    explanation,
    ...(recipients.length > 1
      ? recipients.map((r) => `${r.email}: ${labelOf(normalizeEmailStatus(r.status))}`)
      : []),
  ].filter(Boolean);

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span
        data-email-status={status}
        title={tooltipLines.join('\n')}
        className={cn(
          'inline-flex items-center gap-0.5 rounded-full border px-1.5 py-px text-2xs font-semibold leading-4 whitespace-nowrap',
          TONE_CLASS[tone],
        )}
      >
        <Icon className="size-2.5 shrink-0" aria-hidden="true" />
        {EMAIL_STATUS_LABEL[status]}
      </span>
      {showMessage && explanation && <span className="text-2xs text-stone-500 dark:text-stone-400">{explanation}</span>}
    </span>
  );
}
