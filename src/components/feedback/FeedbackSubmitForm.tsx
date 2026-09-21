import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { AlertCircle, Send } from 'lucide-react';
import { feedbackService } from '@/services/feedbackService';
import { attachmentService } from '@/services/attachmentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { fieldCls, fieldLabelCls, textareaCls, textareaErrorCls } from '@/components/crm/formUtils';
import { FeedbackAttachmentPicker } from '@/components/feedback/FeedbackAttachmentPicker';
import { FeedbackSubmitAside } from '@/components/feedback/FeedbackSubmitAside';
import { FeedbackSubmitSuccess } from '@/components/feedback/FeedbackSubmitSuccess';
import { FEEDBACK_CARD_CLS } from '@/components/feedback/feedbackStyles';
import { Button } from '@/components/ui/button';
import { useLastAppPathStore } from '@/store/useLastAppPathStore';
import {
  FEEDBACK_AREA_OPTIONS,
  FEEDBACK_CATEGORY_OPTIONS,
  MAX_DESCRIPTION_LENGTH,
  resolveFeedbackArea,
  validateFeedbackDescription,
} from '@/lib/feedback';
import { cn } from '@/lib/utils';
import type { FeedbackArea, FeedbackCategory, FeedbackTicket } from '@/types/feedback';

const DEFAULT_CATEGORY: FeedbackCategory = 'general';
const DESCRIPTION_ROWS = 8;

type SubmitResult = { ticket: FeedbackTicket; attachmentError: string | null };

/** Presigns, uploads, and confirms every staged file against a just-created
 *  ticket — the same three-step flow the record-attachment picker uses,
 *  just run in a batch after Submit instead of per-file on selection. */
async function uploadStagedFiles(ticketId: string, files: File[]): Promise<void> {
  const presigned = await feedbackService.presignAttachments(
    ticketId,
    files.map((f) => ({ fileName: f.name, contentType: f.type, sizeBytes: f.size })),
  );
  await Promise.all(presigned.map((p, i) => attachmentService.uploadToR2(p.uploadUrl, files[i])));
  await feedbackService.confirmAttachments(
    ticketId,
    presigned.map((p, i) => ({
      fileName: p.fileName,
      contentType: files[i].type,
      sizeBytes: files[i].size,
      storageKey: p.storageKey,
      checksumSha256: '',
    })),
  );
}

// The "New Ticket" tab of the Support page. Files are staged locally (see
// FeedbackAttachmentPicker) and picked before the ticket exists — the
// backend's attachment endpoints require a feedback_id, so Submit itself
// runs create-ticket-then-upload-staged-files as one action rather than
// asking the reporter to attach files in a second step.
//
// This form lives on /support, so the router's own location says nothing about
// where the problem happened. The area default and the ticket's `pageUrl`
// come from the last page the reporter viewed before opening Support
// (useLastAppPathStore, kept current by MainLayout).
export function FeedbackSubmitForm({
  onSubmitted,
  onViewTicket,
}: {
  onSubmitted: (ticket: FeedbackTicket) => void;
  onViewTicket: (ticket: FeedbackTicket) => void;
}) {
  const lastAppPath = useLastAppPathStore((s) => s.path);
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>(DEFAULT_CATEGORY);
  const [area, setArea] = useState<FeedbackArea>(() => resolveFeedbackArea(lastAppPath));
  const [description, setDescription] = useState('');
  const [stagedFiles, setStagedFiles] = useState<File[]>([]);
  const [touched, setTouched] = useState(false);

  const descriptionError = touched ? validateFeedbackDescription(description) : null;

  const submitMutation = useMutation({
    mutationFn: async (): Promise<SubmitResult> => {
      const ticket = await feedbackService.submit({
        category,
        area,
        rating,
        description: description.trim(),
        // Empty right after a hard reload on /support — nothing to report then.
        pageUrl: lastAppPath || undefined,
      });

      // Files failing to attach must not read as "your report was lost" —
      // the ticket already exists at this point, so a failure here is
      // reported as a partial-success note, not a mutation error.
      let attachmentError: string | null = null;
      if (stagedFiles.length > 0) {
        try {
          await uploadStagedFiles(ticket.id, stagedFiles);
        } catch (err) {
          attachmentError = apiErrorMessage(err, 'The ticket was submitted, but attaching your file(s) failed.');
        }
      }
      return { ticket, attachmentError };
    },
    onSuccess: ({ ticket }) => onSubmitted(ticket),
  });

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setTouched(true);
    if (validateFeedbackDescription(description)) return;
    submitMutation.mutate();
  };

  const resetForm = (): void => {
    setRating(null);
    setCategory(DEFAULT_CATEGORY);
    setArea(resolveFeedbackArea(lastAppPath));
    setDescription('');
    setStagedFiles([]);
    setTouched(false);
    submitMutation.reset();
  };

  if (submitMutation.isSuccess) {
    const { ticket, attachmentError } = submitMutation.data;
    return (
      <div className={FEEDBACK_CARD_CLS}>
        <FeedbackSubmitSuccess
          ticket={ticket}
          attachmentError={attachmentError}
          onViewTicket={() => onViewTicket(ticket)}
          onSubmitAnother={resetForm}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
      <section className={cn(FEEDBACK_CARD_CLS, 'space-y-5 p-5 sm:p-6')}>
        <div>
          <h2 className="text-base font-semibold text-stone-900 dark:text-stone-100">What would you like to tell us?</h2>
          <p className="mt-0.5 text-sm text-stone-500 dark:text-stone-400">
            Report a bug, request a feature, or share how we can do better.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="feedback-category" className={fieldLabelCls}>
              <span className="text-red-500">*</span> Category
            </label>
            <select
              id="feedback-category"
              value={category}
              onChange={(e) => setCategory(e.target.value as FeedbackCategory)}
              className={cn(fieldCls, 'mt-1.5')}
            >
              {FEEDBACK_CATEGORY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="feedback-area" className={fieldLabelCls}>Where did this happen?</label>
            <select
              id="feedback-area"
              value={area}
              onChange={(e) => setArea(e.target.value as FeedbackArea)}
              className={cn(fieldCls, 'mt-1.5')}
            >
              {FEEDBACK_AREA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="feedback-description" className={fieldLabelCls}>
            <span className="text-red-500">*</span> Your Feedback / Description
          </label>
          <textarea
            id="feedback-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => setTouched(true)}
            rows={DESCRIPTION_ROWS}
            maxLength={MAX_DESCRIPTION_LENGTH}
            placeholder="Tell us what you like, what went wrong, or what feature you would love to see…"
            className={cn(descriptionError ? textareaErrorCls : textareaCls, 'mt-1.5 text-sm')}
            aria-invalid={Boolean(descriptionError)}
            aria-describedby={descriptionError ? 'feedback-description-error' : undefined}
          />
          <div className="mt-1 flex items-center justify-between">
            {descriptionError ? (
              <p id="feedback-description-error" className="text-xs text-destructive">{descriptionError}</p>
            ) : <span />}
            <span className="text-xs text-stone-400">{description.length}/{MAX_DESCRIPTION_LENGTH}</span>
          </div>
        </div>

        <div>
          <p className={fieldLabelCls}>Screenshot / File <span className="font-normal text-stone-400">(optional)</span></p>
          <div className="mt-1.5">
            <FeedbackAttachmentPicker files={stagedFiles} onFilesChange={setStagedFiles} disabled={submitMutation.isPending} />
          </div>
        </div>

        {submitMutation.isError && (
          <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/15 bg-destructive/5 px-3.5 py-2.5">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-destructive/70" aria-hidden="true" />
            <p className="text-sm text-destructive">{apiErrorMessage(submitMutation.error, 'Failed to submit feedback.')}</p>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-stone-100 pt-4 dark:border-white/10">
          <p className="text-xs text-stone-500 dark:text-stone-400">
            Fields marked <span className="text-red-500">*</span> are required.
          </p>
          <Button type="submit" size="lg" disabled={submitMutation.isPending} className="gap-2">
            <Send className="size-4" aria-hidden="true" />
            {submitMutation.isPending ? 'Submitting…' : 'Submit ticket'}
          </Button>
        </div>
      </section>

      <FeedbackSubmitAside rating={rating} onRatingChange={setRating} pagePath={lastAppPath} />
    </form>
  );
}
