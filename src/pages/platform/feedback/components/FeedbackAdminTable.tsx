import { useNavigate } from 'react-router-dom';
import { Star } from 'lucide-react';
import { Spinner } from '@/components/tenant/ui';
import {
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
  const navigate = useNavigate();

  if (isLoading) return <div className="flex justify-center py-10"><Spinner label="Loading tickets…" /></div>;
  if (tickets.length === 0) {
    return <p className="py-10 text-center text-xs italic text-stone-400">No feedback tickets match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 dark:border-white/10">
      <table className="w-full min-w-[860px] text-left text-xs">
        <thead className="border-b border-stone-200 bg-stone-50 text-2xs font-semibold uppercase tracking-wider text-stone-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-stone-400">
          <tr>
            <th className="px-3.5 py-2.5">Ticket</th>
            <th className="px-3.5 py-2.5">Tenant</th>
            <th className="px-3.5 py-2.5">Reporter</th>
            <th className="px-3.5 py-2.5">Category</th>
            <th className="px-3.5 py-2.5">Description</th>
            <th className="px-3.5 py-2.5">Priority</th>
            <th className="px-3.5 py-2.5">Status</th>
            <th className="px-3.5 py-2.5">Submitted</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-stone-100 dark:divide-white/5">
          {tickets.map((ticket) => {
            const category = feedbackCategoryOption(ticket.category);
            return (
              <tr key={ticket.id} className="transition-colors hover:bg-stone-50 dark:hover:bg-white/[0.03]">
                <td className="px-3.5 py-2.5">
                  <button
                    type="button"
                    onClick={() => navigate(`/platform/feedback/${ticket.id}`)}
                    className="font-semibold text-stone-700 hover:text-brand-dark transition-colors dark:text-stone-200"
                  >
                    {ticket.ticketNumber}
                  </button>
                </td>
                <td className="px-3.5 py-2.5 text-stone-600 dark:text-stone-300">{ticket.tenantName || '—'}</td>
                <td className="px-3.5 py-2.5 text-stone-600 dark:text-stone-300">{ticket.reporterName || ticket.reporterEmail}</td>
                <td className="px-3.5 py-2.5">
                  <span className="inline-flex items-center gap-1.5 text-stone-600 dark:text-stone-300">
                    <category.icon className="size-3.5 shrink-0 text-stone-400" aria-hidden="true" />
                    {category.label}
                  </span>
                </td>
                <td className="max-w-72 truncate px-3.5 py-2.5 text-stone-600 dark:text-stone-300" title={ticket.description}>
                  {ticket.description}
                  {typeof ticket.rating === 'number' && ticket.rating > 0 && (
                    <span className="ml-1.5 inline-flex items-center gap-0.5 text-amber-500">
                      <Star className="size-2.5 fill-amber-400" />{ticket.rating}
                    </span>
                  )}
                </td>
                <td className="px-3.5 py-2.5">
                  <span className={cn('rounded-full px-2 py-0.5 text-2xs font-semibold', FEEDBACK_PRIORITY_COLORS[ticket.priority as FeedbackPriority])}>
                    {feedbackPriorityLabel(ticket.priority)}
                  </span>
                </td>
                <td className="px-3.5 py-2.5">
                  <span className={cn('rounded-full px-2 py-0.5 text-2xs font-semibold', FEEDBACK_STATUS_COLORS[ticket.status as FeedbackStatus])}>
                    {feedbackStatusLabel(ticket.status)}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3.5 py-2.5 text-stone-400">{formatFeedbackTime(ticket.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
