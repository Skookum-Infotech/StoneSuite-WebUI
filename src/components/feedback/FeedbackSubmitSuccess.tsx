import { AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { FeedbackTicket } from '@/types/feedback';

// What the reporter sees once a ticket exists. `attachmentError` is set when
// the ticket was created but its files could not be attached — the ticket is
// already filed at that point, so it is a warning beside the confirmation, not
// a failure that replaces it.
export function FeedbackSubmitSuccess({
  ticket,
  attachmentError,
  onViewTicket,
  onSubmitAnother,
}: {
  ticket: FeedbackTicket;
  attachmentError: string | null;
  onViewTicket: () => void;
  onSubmitAnother: () => void;
}) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center px-6 py-16 text-center motion-safe:animate-in motion-safe:fade-in duration-200">
      <span className="flex size-14 items-center justify-center rounded-full bg-brand/25 text-brand-dark">
        <CheckCircle2 className="size-7" aria-hidden="true" />
      </span>
      <h2 className="mt-4 text-lg font-bold tracking-tight text-stone-900 dark:text-stone-100">
        Ticket {ticket.ticketNumber} submitted
      </h2>
      <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
        Thanks for telling us. You&apos;ll get a notification as soon as support replies.
      </p>

      {attachmentError && (
        <div
          role="alert"
          className="mt-5 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-left dark:border-amber-500/20 dark:bg-amber-500/10"
        >
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
          <p className="text-xs text-amber-800 dark:text-amber-300">{attachmentError}</p>
        </div>
      )}

      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <Button type="button" size="lg" onClick={onViewTicket}>View ticket</Button>
        <Button type="button" size="lg" variant="outline" onClick={onSubmitAnother}>Submit another</Button>
      </div>
    </div>
  );
}
