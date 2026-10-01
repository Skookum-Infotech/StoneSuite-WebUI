import { AlertTriangle, CheckCircle2, Clock, MailWarning, RefreshCw, Send, XCircle, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EMAIL_STATUS_LABEL, normalizeEmailStatus } from '@/lib/emailStatus';
import type { EmailStatus, EmailStatusFields } from '@/types/emailStatus';

type Tone = 'ok' | 'progress' | 'warn' | 'bad';

// Colour reinforces the label and icon; it is never the only signal.
const TONE_CLASS: Record<Tone, string> = {
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  progress: 'border-stone-200 bg-stone-100 text-stone-600 dark:border-stone-700 dark:bg-stone-800 dark:text-stone-300',
  warn: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300',
  bad: 'border-red-200 bg-red-50 text-red-600 dark:border-red-800 dark:bg-red-950 dark:text-red-300',
};

const VISUAL: Record<Exclude<EmailStatus, 'unknown'>, { tone: Tone; icon: LucideIcon }> = {
  queued: { tone: 'progress', icon: Clock },
  sent: { tone: 'progress', icon: Send },
  retrying: { tone: 'warn', icon: RefreshCw },
  delayed: { tone: 'warn', icon: Clock },
  delivered: { tone: 'ok', icon: CheckCircle2 },
  complained: { tone: 'bad', icon: AlertTriangle },
  bounced: { tone: 'bad', icon: XCircle },
  failed: { tone: 'bad', icon: XCircle },
  suppressed: { tone: 'bad', icon: MailWarning },
  skipped: { tone: 'progress', icon: Send },
};

const UNKNOWN_LABEL = 'Unknown';

function labelOf(status: EmailStatus): string {
  return status === 'unknown' ? UNKNOWN_LABEL : EMAIL_STATUS_LABEL[status];
}

interface EmailStatusBadgeProps {
  source: EmailStatusFields;
  // Render the backend's explanation as visible text under the badge. Use it
  // in detail views; leave it off in compact list rows (the tooltip still has it).
  showMessage?: boolean;
}

// EmailStatusBadge shows what happened to an email a user sent: queued, sent,
// delivered, or a problem (bounced, delayed, …). Renders nothing when the row
// carries no usable status, so legacy rows and a notification-service outage
// look like "no information", not like an error.
export function EmailStatusBadge({ source, showMessage = false }: EmailStatusBadgeProps) {
  const status = normalizeEmailStatus(source.emailStatus);
  if (status === 'unknown') return null;

  const { tone, icon: Icon } = VISUAL[status];
  const message = source.emailStatusMessage;
  const recipients = source.emailRecipients ?? [];

  // The tooltip adds detail; it is never the only place a message appears.
  const tooltipLines = [
    message,
    ...(recipients.length > 1
      ? recipients.map((r) => `${r.email}: ${labelOf(normalizeEmailStatus(r.status))}`)
      : []),
  ].filter(Boolean);

  return (
    <span className="inline-flex flex-col items-start gap-0.5">
      <span
        data-email-status={status}
        title={tooltipLines.length ? tooltipLines.join('\n') : undefined}
        className={cn(
          'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-label font-semibold whitespace-nowrap',
          TONE_CLASS[tone],
        )}
      >
        <Icon className="size-3" aria-hidden="true" />
        {EMAIL_STATUS_LABEL[status]}
      </span>
      {showMessage && message && <span className="text-2xs text-stone-500 dark:text-stone-400">{message}</span>}
    </span>
  );
}
