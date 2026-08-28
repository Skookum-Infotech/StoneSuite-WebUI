import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Download, EyeOff, Paperclip, Send, ShieldCheck } from 'lucide-react';
import { feedbackAdminService } from '@/services/feedbackAdminService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { textareaCls } from '@/components/crm/formUtils';
import {
  MAX_COMMENT_LENGTH,
  feedbackAreaLabel,
  feedbackStatusLabel,
  formatFeedbackFileSize,
  formatFeedbackTime,
  validateFeedbackComment,
} from '@/lib/feedback';
import { cn } from '@/lib/utils';
import type { FeedbackComment, FeedbackTicketDetail } from '@/types/feedback';

function StatusChangeEntry({ comment }: { comment: FeedbackComment }) {
  return (
    <div className="flex items-center gap-2 py-1 text-2xs text-stone-500 dark:text-stone-400">
      <ShieldCheck className="size-3 shrink-0 text-stone-400" />
      <span>
        {comment.authorName || 'An admin'} moved this to{' '}
        <span className="font-semibold text-stone-700 dark:text-stone-200">{feedbackStatusLabel(comment.newStatus ?? '')}</span>
      </span>
      <span className="text-stone-300 dark:text-stone-600">·</span>
      <span>{formatFeedbackTime(comment.createdAt)}</span>
    </div>
  );
}

function CommentEntry({ comment }: { comment: FeedbackComment }) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3.5 py-2.5',
        comment.isInternal
          ? 'border-amber-200 bg-amber-50 dark:border-amber-500/20 dark:bg-amber-500/10'
          : 'border-stone-100 bg-stone-50 dark:border-white/10 dark:bg-white/[0.03]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-2xs font-semibold text-stone-700 dark:text-stone-200">
          {comment.authorName || (comment.authorKind === 'platform_admin' ? 'Platform Admin' : 'Reporter')}
        </span>
        <div className="flex items-center gap-1.5">
          {comment.isInternal && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-2xs font-semibold text-amber-700 dark:bg-amber-500/20 dark:text-amber-400">
              <EyeOff className="size-2.5" />Internal
            </span>
          )}
          <span className="text-2xs text-stone-400">{formatFeedbackTime(comment.createdAt)}</span>
        </div>
      </div>
      <p className="mt-1 whitespace-pre-wrap text-xs text-stone-700 dark:text-stone-200">{comment.body}</p>
    </div>
  );
}

export function FeedbackDetailTimeline({ detail }: { detail: FeedbackTicketDetail }) {
  const queryClient = useQueryClient();
  const { ticket, comments, attachments } = detail;
  const [reply, setReply] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [touched, setTouched] = useState(false);

  const replyMutation = useMutation({
    mutationFn: () => feedbackAdminService.addComment(ticket.id, reply.trim(), isInternal),
    onSuccess: () => {
      setReply('');
      setTouched(false);
      void queryClient.invalidateQueries({ queryKey: ['platform-feedback-detail', ticket.id] });
    },
  });

  const handleDownload = async (attachmentId: string): Promise<void> => {
    const { downloadUrl, fileName } = await feedbackAdminService.downloadAttachment(ticket.id, attachmentId);
    const a = document.createElement('a');
    a.href = downloadUrl; a.download = fileName; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.click();
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setTouched(true);
    if (validateFeedbackComment(reply)) return;
    replyMutation.mutate();
  };

  const replyError = touched ? validateFeedbackComment(reply) : null;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <p className="whitespace-pre-wrap text-sm text-stone-700 dark:text-stone-200">{ticket.description}</p>
        {(ticket.area || ticket.pageUrl || ticket.userAgent) && (
          <div className="mt-3 space-y-0.5 border-t border-stone-100 pt-3 text-2xs text-stone-400 dark:border-white/10">
            {ticket.area && <p>Area: <span className="text-stone-500 dark:text-stone-300">{feedbackAreaLabel(ticket.area)}</span></p>}
            {ticket.pageUrl && <p>Page: <span className="text-stone-500 dark:text-stone-300">{ticket.pageUrl}</span></p>}
            {ticket.userAgent && <p className="truncate">Browser: <span className="text-stone-500 dark:text-stone-300">{ticket.userAgent}</span></p>}
          </div>
        )}
        {attachments.length > 0 && (
          <ul className="mt-3 space-y-1 border-t border-stone-100 pt-3 dark:border-white/10">
            {attachments.map((att) => (
              <li key={att.id}>
                <button
                  type="button"
                  onClick={() => void handleDownload(att.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-dark hover:underline"
                >
                  <Paperclip className="size-3.5" />
                  {att.fileName}
                  <span className="text-stone-400">({formatFeedbackFileSize(att.sizeBytes)})</span>
                  <Download className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="space-y-2.5">
        <p className="text-xs font-semibold text-stone-400">Timeline</p>
        {comments.length === 0 ? (
          <p className="text-xs italic text-stone-400">No replies yet.</p>
        ) : (
          comments.map((c) =>
            c.eventType === 'status_change' ? <StatusChangeEntry key={c.id} comment={c} /> : <CommentEntry key={c.id} comment={c} />,
          )
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2 rounded-xl border border-stone-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/[0.03]">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onBlur={() => setTouched(true)}
          rows={3}
          maxLength={MAX_COMMENT_LENGTH}
          placeholder={isInternal ? 'Internal note (not visible to the reporter)…' : 'Reply to the reporter…'}
          aria-label={isInternal ? 'Internal note' : 'Reply to reporter'}
          className={textareaCls}
        />
        <div className="flex items-center justify-between gap-3">
          <label htmlFor="fb-internal-toggle" className="flex items-center gap-2 text-2xs font-medium text-stone-600 dark:text-stone-300">
            <Switch id="fb-internal-toggle" checked={isInternal} onCheckedChange={setIsInternal} />
            Internal note (admins only)
          </label>
          <Button type="submit" size="sm" disabled={replyMutation.isPending} className="gap-1.5">
            <Send className="size-3" />
            {replyMutation.isPending ? 'Sending…' : isInternal ? 'Add note' : 'Reply'}
          </Button>
        </div>
        {replyError && (
          <div className="flex items-center gap-1.5">
            <AlertCircle className="size-3 shrink-0 text-destructive/70" />
            <p className="text-2xs text-destructive">{replyError}</p>
          </div>
        )}
        {replyMutation.isError && (
          <p className="text-2xs text-destructive">{apiErrorMessage(replyMutation.error, 'Failed to send.')}</p>
        )}
      </form>
    </div>
  );
}
