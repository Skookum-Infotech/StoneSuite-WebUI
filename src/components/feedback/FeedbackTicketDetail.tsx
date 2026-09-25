import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, Paperclip, Star } from 'lucide-react';
import { feedbackService } from '@/services/feedbackService';
import { apiErrorMessage } from '@/api/tenantClient';
import { ErrorNote } from '@/components/tenant/ui';
import { FeedbackConversation } from '@/components/feedback/FeedbackConversation';
import { FeedbackReplyForm } from '@/components/feedback/FeedbackReplyForm';
import { FeedbackStatusPill } from '@/components/feedback/FeedbackStatusPill';
import {
  feedbackAreaLabel,
  feedbackCategoryOption,
  formatFeedbackFileSize,
  formatFeedbackTime,
} from '@/lib/feedback';
import type { FeedbackAttachment } from '@/types/feedback';

const CHIP_CLS =
  'inline-flex items-center gap-1.5 rounded-md bg-stone-100 px-2 py-1 font-medium text-stone-600 dark:bg-white/10 dark:text-stone-300';

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      type="button"
      onClick={onBack}
      aria-label="Back to tickets"
      className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 transition-colors hover:text-stone-800 dark:hover:text-stone-200"
    >
      <ArrowLeft className="size-3.5" aria-hidden="true" />
      Back to tickets
    </button>
  );
}

function DetailSkeleton() {
  return (
    <div role="status" aria-label="Loading ticket" className="space-y-4 p-5">
      <div className="h-6 w-40 rounded-md bg-stone-100 motion-safe:animate-pulse dark:bg-white/10" />
      <div className="h-4 w-2/3 rounded-md bg-stone-100 motion-safe:animate-pulse dark:bg-white/10" />
      <div className="h-24 w-full rounded-lg bg-stone-100 motion-safe:animate-pulse dark:bg-white/10" />
    </div>
  );
}

// One ticket as its reporter sees it: what they filed, what support has said
// since, and a composer to reply. `onBack` is only passed in single-pane
// (narrow) layouts, where this replaces the ticket list instead of sitting
// beside it.
export function FeedbackTicketDetail({ ticketId, onBack }: { ticketId: string; onBack?: () => void }) {
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const detailQ = useQuery({
    queryKey: ['feedback-ticket', ticketId],
    queryFn: () => feedbackService.getMine(ticketId),
  });

  const handleDownload = async (attachment: FeedbackAttachment): Promise<void> => {
    setDownloadError(null);
    try {
      const { downloadUrl, fileName } = await feedbackService.downloadAttachment(ticketId, attachment.id);
      const a = document.createElement('a');
      a.href = downloadUrl; a.download = fileName; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.click();
    } catch (err) {
      setDownloadError(`Couldn't download ${attachment.fileName}: ${apiErrorMessage(err, 'please try again.')}`);
    }
  };

  if (detailQ.isLoading) return <DetailSkeleton />;

  // Deliberately generic: a 404 can mean "exists but isn't yours", so the
  // server's own wording is never echoed.
  if (detailQ.isError || !detailQ.data) {
    return (
      <div className="space-y-3 p-5">
        {onBack && <BackButton onBack={onBack} />}
        <div role="alert">
          <ErrorNote>We couldn&apos;t load this ticket. It may no longer be available.</ErrorNote>
        </div>
      </div>
    );
  }

  const { ticket, comments, attachments } = detailQ.data;
  const category = feedbackCategoryOption(ticket.category);
  const rated = typeof ticket.rating === 'number' && ticket.rating > 0;

  return (
    <section
      aria-label={`Ticket ${ticket.ticketNumber}`}
      className="flex h-full min-h-0 flex-col motion-safe:animate-in motion-safe:fade-in duration-150"
    >
      <header className="shrink-0 border-b border-stone-200 px-5 py-4 dark:border-white/10">
        {onBack && <BackButton onBack={onBack} />}
        <div className="flex flex-wrap items-center gap-2.5">
          <h2 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">{ticket.ticketNumber}</h2>
          <FeedbackStatusPill status={ticket.status} />
          {rated && (
            <span aria-label={`Rated ${ticket.rating} out of 5`} className="inline-flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
              <Star className="size-3.5 fill-amber-400 text-amber-400" aria-hidden="true" />
              {ticket.rating}
            </span>
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-stone-500 dark:text-stone-400">
          <span className={CHIP_CLS}>
            <category.icon className="size-3.5" aria-hidden="true" />
            {category.label}
          </span>
          {ticket.area && <span className={CHIP_CLS}>{feedbackAreaLabel(ticket.area)}</span>}
          <span>Submitted {formatFeedbackTime(ticket.createdAt)}</span>
          {ticket.updatedAt !== ticket.createdAt && <span>Updated {formatFeedbackTime(ticket.updatedAt)}</span>}
        </div>
      </header>

      <div className="modal-scrollbar min-h-0 flex-1 space-y-7 overflow-y-auto px-5 py-5">
        <section aria-label="Your report" className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Your report</h3>
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-stone-800 dark:text-stone-100">
            {ticket.description}
          </p>
          {ticket.pageUrl && (
            <p className="text-xs text-stone-500 dark:text-stone-400">
              Reported from{' '}
              <code className="rounded bg-stone-100 px-1.5 py-0.5 font-mono text-[0.8125rem] text-stone-600 dark:bg-white/10 dark:text-stone-300">
                {ticket.pageUrl}
              </code>
            </p>
          )}
          {attachments.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {attachments.map((attachment) => (
                <li key={attachment.id}>
                  <button
                    type="button"
                    onClick={() => void handleDownload(attachment)}
                    aria-label={`Download ${attachment.fileName}`}
                    className="inline-flex items-center gap-2 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 transition-colors hover:bg-stone-50 dark:border-white/10 dark:bg-white/[0.04] dark:text-stone-200 dark:hover:bg-white/[0.08]"
                  >
                    <Paperclip className="size-3.5 text-stone-400" aria-hidden="true" />
                    {attachment.fileName}
                    <span className="text-stone-400">{formatFeedbackFileSize(attachment.sizeBytes)}</span>
                    <Download className="size-3.5 text-stone-400" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {downloadError && (
            <p role="alert" className="text-xs text-destructive">{downloadError}</p>
          )}
        </section>

        <FeedbackConversation comments={comments} />
      </div>

      <FeedbackReplyForm ticketId={ticket.id} />
    </section>
  );
}
