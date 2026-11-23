import { FEEDBACK_STATUS_COLORS, feedbackStatusLabel } from '@/lib/feedback';
import { cn } from '@/lib/utils';
import type { FeedbackStatus } from '@/types/feedback';

// The status chip shown on ticket rows and the ticket header. The label is
// always spelled out, so the state never relies on colour alone.
export function FeedbackStatusPill({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-semibold',
        FEEDBACK_STATUS_COLORS[status as FeedbackStatus],
      )}
    >
      {feedbackStatusLabel(status)}
    </span>
  );
}
