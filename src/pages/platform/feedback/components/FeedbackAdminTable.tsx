import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Spinner } from '@/components/tenant/ui';
import {
  feedbackAreaLabel,
  feedbackCategoryOption,
  feedbackPriorityLabel,
  feedbackStatusLabel,
  formatFeedbackTime,
  FEEDBACK_PRIORITY_COLORS,
  FEEDBACK_STATUS_COLORS,
} from '@/lib/feedback';
import { cn } from '@/lib/utils';
import type { FeedbackPriority, FeedbackStatus, FeedbackTicket } from '@/types/feedback';

export function FeedbackAdminTable({ tickets, isLoading }: { tickets: FeedbackTicket[]; isLoading: boolean }) {

  if (isLoading) return <div className="flex justify-center py-10"><Spinner label="Loading tickets…" /></div>;
  if (tickets.length === 0) {
    return <p className="py-10 text-center italic type-helper">No feedback tickets match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-white/10">
      <table className="w-full min-w-[860px] text-left type-cell">
        <thead className="border-b border-stone-200 bg-stone-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-400 type-th">
          <tr>
            <th className="type-th px-3.5 py-2.5">Ticket</th>
            <th className="type-th px-3.5 py-2.5">Tenant</th>
            <th className="type-th px-3.5 py-2.5">Reporter</th>
            <th className="type-th px-3.5 py-2.5">Category</th>
            <th className="type-th px-3.5 py-2.5">Description</th>
            <th className="type-th px-3.5 py-2.5">Priority</th>
            <th className="type-th px-3.5 py-2.5">Status</th>
            <th className="type-th px-3.5 py-2.5">Submitted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-white/5">
          {tickets.map((ticket) => {
            const category = feedbackCategoryOption(ticket.category);
            return (
              <tr key={ticket.id} className="transition-colors hover:bg-stone-50 dark:hover:bg-white/[0.03]">
                <td className="px-3.5 py-2.5">
                  <Link
                    to={`/platform/feedback/${ticket.id}`}
                    className="font-semibold text-ink hover:text-link transition-colors dark:text-stone-200"
                  >
                    {ticket.ticketNumber}
                  </Link>
                </td>
                <td className="type-cell px-3.5 py-2.5 dark:text-stone-300">{ticket.tenantName || '—'}</td>
                <td className="type-cell px-3.5 py-2.5 dark:text-stone-300">{ticket.reporterName || ticket.reporterEmail}</td>
                <td className="px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-ink dark:text-stone-300">
                    <category.icon className="size-3.5 shrink-0 text-ink-muted" aria-hidden="true" />
                    {category.label}
                  </span>
                  {ticket.area && (
                    <span className="mt-0.5 block type-subline">{feedbackAreaLabel(ticket.area)}</span>
                  )}
                </td>
                <td className="type-cell max-w-72 truncate px-3.5 py-2.5 dark:text-stone-300" title={ticket.description}>
                  {ticket.description}
                  {typeof ticket.rating === 'number' && ticket.rating > 0 && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-warning-ink">
                      <Star className="size-2.5 fill-amber-400" />{ticket.rating}
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-2.5">
                  <span className={cn('rounded-full px-2 py-0.5 type-pill', FEEDBACK_PRIORITY_COLORS[ticket.priority as FeedbackPriority])}>
                    {feedbackPriorityLabel(ticket.priority)}
                  </span>
                </td>
                <td className="px-3.5 py-2.5">
                  <span className={cn('rounded-full px-2 py-0.5 type-pill', FEEDBACK_STATUS_COLORS[ticket.status as FeedbackStatus])}>
                    {feedbackStatusLabel(ticket.status)}
                  </span>
                </td>
                <td className="type-cell whitespace-nowrap px-3.5 py-2.5">{formatFeedbackTime(ticket.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
