import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AlertTriangle, CheckCircle2, Send, AlertCircle } from 'lucide-react';
import { feedbackService } from '@/services/feedbackService';
import { attachmentService } from '@/services/attachmentService';
import { apiErrorMessage } from '@/api/tenantClient';
import { fieldCls, fieldLabelCls, textareaCls, textareaErrorCls } from '@/components/crm/formUtils';
import { StarRating } from '@/components/feedback/StarRating';
import { FeedbackAttachmentPicker } from '@/components/feedback/FeedbackAttachmentPicker';
import { Button } from '@/components/ui/button';
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

// The "Submit" tab of the feedback panel. Files are staged locally (see
// FeedbackAttachmentPicker) and picked before the ticket exists — the
// backend's attachment endpoints require a feedback_id, so Submit itself
// runs create-ticket-then-upload-staged-files as one action rather than
// asking the reporter to attach files in a second step.
export function FeedbackSubmitForm({ onSubmitted }: { onSubmitted: (ticket: FeedbackTicket) => void }) {
  const location = useLocation();
  const [rating, setRating] = useState<number | null>(null);
  const [category, setCategory] = useState<FeedbackCategory>(DEFAULT_CATEGORY);
  const [area, setArea] = useState<FeedbackArea>(() => resolveFeedbackArea(location.pathname));
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
        pageUrl: window.location.pathname + window.location.search,
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
    setArea(resolveFeedbackArea(location.pathname));
    setDescription('');
    setStagedFiles([]);
    setTouched(false);
    submitMutation.reset();
  };

  if (submitMutation.isSuccess) {
    const { ticket, attachmentError } = submitMutation.data;
    return (
      <div className="space-y-4">
        <div className="flex items-start gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3.5 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div>
            <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
              Thanks — ticket {ticket.ticketNumber} submitted.
            </p>
            <p className="mt-0.5 text-2xs text-emerald-700/80 dark:text-emerald-400/80">
              You can track it under &ldquo;My Tickets&rdquo;.
            </p>
          </div>
        </div>

        {attachmentError && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 dark:border-amber-500/20 dark:bg-amber-500/10">
            <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <p className="text-2xs text-amber-800 dark:text-amber-300">{attachmentError}</p>
          </div>
        )}

        <Button type="button" variant="outline" size="sm" onClick={resetForm} className="w-full">
          Submit another
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <p className={fieldLabelCls}>How would you rate your experience? <span className="font-normal text-stone-400">(optional)</span></p>
        <div className="mt-2 flex justify-center rounded-xl bg-stone-50 py-4 dark:bg-white/[0.04]">
          <StarRating value={rating} onChange={setRating} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
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
          rows={4}
          maxLength={MAX_DESCRIPTION_LENGTH}
          placeholder="Tell us what you like, what went wrong, or what feature you would love to see…"
          className={cn(descriptionError ? textareaErrorCls : textareaCls, 'mt-1.5')}
          aria-invalid={Boolean(descriptionError)}
          aria-describedby={descriptionError ? 'feedback-description-error' : undefined}
        />
        <div className="mt-1 flex items-center justify-between">
          {descriptionError ? (
            <p id="feedback-description-error" className="text-2xs text-destructive">{descriptionError}</p>
          ) : <span />}
          <span className="text-2xs text-stone-400">{description.length}/{MAX_DESCRIPTION_LENGTH}</span>
        </div>
      </div>

      <div>
        <p className={fieldLabelCls}>Screenshot / File <span className="font-normal text-stone-400">(optional)</span></p>
        <div className="mt-1.5">
          <FeedbackAttachmentPicker files={stagedFiles} onFilesChange={setStagedFiles} disabled={submitMutation.isPending} />
        </div>
      </div>

      {submitMutation.isError && (
        <div className="flex items-start gap-2 rounded-lg border border-destructive/15 bg-destructive/5 px-3.5 py-2.5">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0 text-destructive/70" />
          <p className="text-xs text-destructive">{apiErrorMessage(submitMutation.error, 'Failed to submit feedback.')}</p>
        </div>
      )}

      <Button type="submit" disabled={submitMutation.isPending} className="w-full gap-2" aria-label="Submit feedback">
        <Send className="size-3.5" />
        {submitMutation.isPending ? 'Submitting…' : 'Submit Feedback'}
      </Button>
    </form>
  );
}
