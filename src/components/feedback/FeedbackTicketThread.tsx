import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, ArrowRight, Download, Paperclip, Send, ShieldCheck } from 'lucide-react';
import { feedbackService } from '@/services/feedbackService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner } from '@/components/tenant/ui';
import { Button } from '@/components/ui/button';
import { textareaCls } from '@/components/crm/formUtils';
import {
  MAX_COMMENT_LENGTH,
  feedbackCategoryLabel,
  feedbackStatusLabel,
  formatFeedbackFileSize,
  formatFeedbackTime,
  validateFeedbackComment,
  FEEDBACK_STATUS_COLORS,
} from '@/lib/feedback';
import { cn } from '@/lib/utils';
import type { FeedbackComment, FeedbackStatus } from '@/types/feedback';

function StatusChangeEntry({ comment }: { comment: FeedbackComment }) {
  return (
    <div className="flex items-center gap-2 py-1.5 text-2xs text-stone-500 dark:text-stone-400">
      <ShieldCheck className="size-3 shrink-0 text-stone-400" />
      <span>
        {comment.authorName || 'An admin'} moved this to{' '}
        <span className="font-semibold text-stone-700 dark:text-stone-200">
          {feedbackStatusLabel(comment.newStatus ?? '')}
        </span>
      </span>
      <span className="text-stone-300 dark:text-stone-600">·</span>
      <span>{formatFeedbackTime(comment.createdAt)}</span>
    </div>
  );
}

function ReplyBubble({ comment }: { comment: FeedbackComment }) {
  const fromAdmin = comment.authorKind === 'platform_admin';
  return (
    <div className={cn('flex flex-col gap-1', fromAdmin ? 'items-start' : 'items-end')}>
      <div
        className={cn(
          'max-w-[85%] rounded-xl px-3 py-2 text-xs',
          fromAdmin
            ? 'rounded-tl-sm bg-stone-100 text-stone-700 dark:bg-white/[0.06] dark:text-stone-200'
            : 'rounded-tr-sm bg-brand/10 text-stone-800 dark:bg-brand/15 dark:text-stone-100',
        )}
      >
        {comment.body}
      </div>
      <span className="px-1 text-2xs text-stone-400">
        {fromAdmin ? comment.authorName || 'Support' : 'You'} · {formatFeedbackTime(comment.createdAt)}
      </span>
    </div>
  );
}

export function FeedbackTicketThread({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [touched, setTouched] = useState(false);

  const detailQ = useQuery({
    queryKey: ['feedback-ticket', ticketId],
    queryFn: () => feedbackService.getMine(ticketId),
  });

  const replyMutation = useMutation({
    mutationFn: (body: string) => feedbackService.addComment(ticketId, body),
    onSuccess: () => {
      setReply('');
      setTouched(false);
      void queryClient.invalidateQueries({ queryKey: ['feedback-ticket', ticketId] });
    },
  });

  const handleDownload = async (attachmentId: string): Promise<void> => {
    const { downloadUrl, fileName } = await feedbackService.downloadAttachment(ticketId, attachmentId);
    const a = document.createElement('a');
    a.href = downloadUrl; a.download = fileName; a.target = '_blank'; a.rel = 'noopener noreferrer';
    a.click();
  };

  const handleReplySubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    setTouched(true);
    if (validateFeedbackComment(reply)) return;
    replyMutation.mutate(reply.trim());
  };

  if (detailQ.isLoading) return <div className="py-4 flex justify-center"><Spinner label="Loading ticket…" /></div>;
  if (detailQ.isError) {
    return <p className="py-3 text-xs text-destructive">{apiErrorMessage(detailQ.error, 'Failed to load ticket.')}</p>;
  }
  if (!detailQ.data) return null;
  const { ticket, comments, attachments } = detailQ.data;
  const replyError = touched ? validateFeedbackComment(reply) : null;

  return (
    <div className="space-y-3 border-t border-stone-100 bg-stone-50/60 px-3.5 py-3.5 dark:border-white/5 dark:bg-white/[0.02]">
      <div className="flex items-center gap-2 text-2xs">
        <span className="rounded-full bg-stone-200 px-2 py-0.5 font-medium text-stone-600 dark:bg-white/10 dark:text-stone-300">
          {feedbackCategoryLabel(ticket.category)}
        </span>
        <ArrowRight className="size-3 text-stone-300" />
        <span className={cn('rounded-full px-2 py-0.5 font-semibold', FEEDBACK_STATUS_COLORS[ticket.status as FeedbackStatus])}>
          {feedbackStatusLabel(ticket.status)}
        </span>
      </div>

      <p className="whitespace-pre-wrap text-xs text-stone-700 dark:text-stone-200">{ticket.description}</p>

      {attachments.length > 0 && (
        <ul className="space-y-1">
          {attachments.map((att) => (
            <li key={att.id}>
              <button
                type="button"
                onClick={() => void handleDownload(att.id)}
                className="inline-flex items-center gap-1.5 text-2xs font-medium text-brand-dark hover:underline"
              >
                <Paperclip className="size-3" />
                {att.fileName}
                <span className="text-stone-400">({formatFeedbackFileSize(att.sizeBytes)})</span>
                <Download className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {comments.length > 0 && (
        <div className="space-y-2 border-t border-stone-200 pt-3 dark:border-white/10">
          {comments.map((c) =>
            c.eventType === 'status_change'
              ? <StatusChangeEntry key={c.id} comment={c} />
              : <ReplyBubble key={c.id} comment={c} />,
          )}
        </div>
      )}

      <form onSubmit={handleReplySubmit} className="space-y-1.5 border-t border-stone-200 pt-3 dark:border-white/10">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onBlur={() => setTouched(true)}
          rows={2}
          maxLength={MAX_COMMENT_LENGTH}
          placeholder="Reply…"
          aria-label="Reply to this ticket"
          className={cn(textareaCls, 'text-xs')}
        />
        {replyError && (
          <div className="flex items-center gap-1.5">
            <AlertCircle className="size-3 shrink-0 text-destructive/70" />
            <p className="text-2xs text-destructive">{replyError}</p>
          </div>
        )}
        {replyMutation.isError && (
          <p className="text-2xs text-destructive">{apiErrorMessage(replyMutation.error, 'Failed to send reply.')}</p>
        )}
        <Button type="submit" size="sm" disabled={replyMutation.isPending} className="gap-1.5">
          <Send className="size-3" />
          {replyMutation.isPending ? 'Sending…' : 'Reply'}
        </Button>
      </form>
    </div>
  );
}
