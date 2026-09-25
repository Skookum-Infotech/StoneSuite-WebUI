import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { AlertCircle, Send } from 'lucide-react';
import { feedbackService } from '@/services/feedbackService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Button } from '@/components/ui/button';
import { textareaCls } from '@/components/crm/formUtils';
import { MAX_COMMENT_LENGTH, validateFeedbackComment } from '@/lib/feedback';
import { cn } from '@/lib/utils';

// The reply composer pinned under a ticket's conversation. A failed send keeps
// what was typed (it is only cleared on success), so a network blip never
// costs the reporter a long message.
export function FeedbackReplyForm({ ticketId }: { ticketId: string }) {
  const queryClient = useQueryClient();
  const [reply, setReply] = useState('');
  const [touched, setTouched] = useState(false);

  const replyMutation = useMutation({
    mutationFn: (body: string) => feedbackService.addComment(ticketId, body),
    onSuccess: () => {
      setReply('');
      setTouched(false);
      void queryClient.invalidateQueries({ queryKey: ['feedback-ticket', ticketId] });
    },
  });

  const send = (): void => {
    setTouched(true);
    if (validateFeedbackComment(reply)) return;
    replyMutation.mutate(reply.trim());
  };

  const handleSubmit = (e: React.FormEvent): void => {
    e.preventDefault();
    send();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      send();
    }
  };

  const replyError = touched ? validateFeedbackComment(reply) : null;

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="shrink-0 border-t border-stone-200 bg-stone-50/70 px-5 py-2 dark:border-white/10 dark:bg-white/[0.02]"
    >
      <div className="flex items-end gap-2">
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          onBlur={() => setTouched(true)}
          onKeyDown={handleKeyDown}
          rows={1}
          maxLength={MAX_COMMENT_LENGTH}
          placeholder="Write a reply…"
          aria-label="Reply to this ticket"
          aria-invalid={Boolean(replyError)}
          className={cn(
            textareaCls,
            'min-h-9 flex-1 py-1.5 text-sm [field-sizing:content] max-h-32',
            replyError && 'border-red-400',
          )}
        />
        <Button type="submit" disabled={replyMutation.isPending} className="shrink-0 gap-1.5">
          <Send className="size-3.5" aria-hidden="true" />
          {replyMutation.isPending ? 'Sending…' : 'Send reply'}
        </Button>
      </div>
      <div className="mt-1 min-w-0 text-xs">
        {replyError ? (
          <p className="flex items-center gap-1.5 text-destructive">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            {replyError}
          </p>
        ) : replyMutation.isError ? (
          <p role="alert" className="text-destructive">
            {apiErrorMessage(replyMutation.error, 'Failed to send reply.')}
          </p>
        ) : (
          <p className="text-stone-400">Press Ctrl + Enter to send</p>
        )}
      </div>
    </form>
  );
}
