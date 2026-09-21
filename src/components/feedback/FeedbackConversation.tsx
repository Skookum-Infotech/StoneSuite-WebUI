import { ShieldCheck } from 'lucide-react';
import { feedbackStatusLabel, formatFeedbackTime } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import type { FeedbackComment } from '@/types/feedback';

function StatusChangeEntry({ comment }: { comment: FeedbackComment }) {
  return (
    <div className="flex items-center gap-3 py-1 text-xs text-stone-500 dark:text-stone-400">
      <span className="h-px flex-1 bg-stone-200 dark:bg-white/10" aria-hidden="true" />
      <span className="flex items-center gap-1.5">
        <ShieldCheck className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
        <span>
          {comment.authorName || 'An admin'} moved this to{' '}
          <span className="font-semibold text-stone-700 dark:text-stone-200">
            {feedbackStatusLabel(comment.newStatus ?? '')}
          </span>
        </span>
        <span className="text-stone-300 dark:text-stone-600" aria-hidden="true">·</span>
        <span>{formatFeedbackTime(comment.createdAt)}</span>
      </span>
      <span className="h-px flex-1 bg-stone-200 dark:bg-white/10" aria-hidden="true" />
    </div>
  );
}

function ReplyBubble({ comment }: { comment: FeedbackComment }) {
  const fromSupport = comment.authorKind === 'platform_admin';
  return (
    <div className={cn('flex flex-col gap-1', fromSupport ? 'items-start' : 'items-end')}>
      <div
        className={cn(
          'max-w-[90%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-sm leading-relaxed sm:max-w-[75%]',
          fromSupport
            ? 'rounded-tl-md bg-stone-100 text-stone-800 dark:bg-white/[0.07] dark:text-stone-100'
            : 'rounded-tr-md bg-brand/20 text-stone-900 dark:bg-brand/15 dark:text-stone-100',
        )}
      >
        {comment.body}
      </div>
      <span className="px-1 text-xs text-stone-500 dark:text-stone-400">
        {fromSupport ? comment.authorName || 'Support' : 'You'} · {formatFeedbackTime(comment.createdAt)}
      </span>
    </div>
  );
}

// A ticket's timeline as the reporter sees it: replies from support on the
// left, their own on the right, and status moves as quiet dividers between.
export function FeedbackConversation({ comments }: { comments: FeedbackComment[] }) {
  return (
    <section aria-label="Conversation">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-stone-400">Conversation</h3>
      {comments.length === 0 ? (
        <p className="mt-3 rounded-xl border border-dashed border-stone-300 px-4 py-6 text-center text-sm text-stone-500 dark:border-white/15 dark:text-stone-400">
          No replies yet. When support responds you&apos;ll see it here and get a notification.
        </p>
      ) : (
        <ol className="mt-4 space-y-4">
          {comments.map((comment) => (
            <li key={comment.id}>
              {comment.eventType === 'status_change'
                ? <StatusChangeEntry comment={comment} />
                : <ReplyBubble comment={comment} />}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
