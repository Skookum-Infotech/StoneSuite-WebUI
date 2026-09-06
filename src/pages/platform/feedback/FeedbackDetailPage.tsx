import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Star } from 'lucide-react';
import { feedbackAdminService } from '@/services/feedbackAdminService';
import { apiErrorMessage } from '@/api/tenantClient';
import { Spinner, ErrorNote } from '@/components/tenant/ui';
import { useBreadcrumbStore } from '@/store/useBreadcrumbStore';
import { useAuthStore } from '@/store/useAuthStore';
import { FeedbackDetailSidebar } from './components/FeedbackDetailSidebar';
import { FeedbackDetailTimeline } from './components/FeedbackDetailTimeline';
import {
  extractAssigneeCandidates,
  feedbackAreaLabel,
  feedbackCategoryLabel,
  feedbackStatusLabel,
  formatFeedbackTime,
  FEEDBACK_STATUS_COLORS,
} from '@/lib/feedback';
import { cn } from '@/lib/utils';
import type { FeedbackStatus } from '@/types/feedback';

export default function FeedbackDetailPage() {
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportPdfError, setExportPdfError] = useState<string | null>(null);

  const detailQ = useQuery({
    queryKey: ['platform-feedback-detail', id],
    queryFn: () => feedbackAdminService.get(id),
    enabled: Boolean(id),
  });

  // Sources the assignee picker's candidates — there is no platform-admin
  // user-list endpoint, so this derives from admins already seen on
  // existing tickets (see extractAssigneeCandidates).
  const assigneesQ = useQuery({
    queryKey: ['platform-feedback-assignees'],
    queryFn: () => feedbackAdminService.list({ limit: 100 }),
    staleTime: 5 * 60 * 1000,
  });
  const currentUser = useAuthStore((s) => s.user);
  const assigneeCandidates = extractAssigneeCandidates(
    assigneesQ.data?.tickets ?? [],
    currentUser ? { id: currentUser.id, name: currentUser.fullName } : undefined,
  );

  const setLabel = useBreadcrumbStore((s) => s.setLabel);
  const clearLabel = useBreadcrumbStore((s) => s.clearLabel);
  useEffect(() => {
    const ticketNumber = detailQ.data?.ticket.ticketNumber;
    if (ticketNumber) {
      setLabel(id, ticketNumber);
      return () => clearLabel(id);
    }
  }, [id, detailQ.data?.ticket.ticketNumber, setLabel, clearLabel]);

  async function handleExportPdf() {
    if (!detailQ.data) return;
    const { ticket, comments } = detailQ.data;
    setExportPdfError(null);
    setExportingPdf(true);
    try {
      const { exportFeedbackTicketToPdf } = await import('@/lib/feedbackPdfExport');
      await exportFeedbackTicketToPdf({
        ticketNumber: ticket.ticketNumber,
        title: ticket.description.slice(0, 80),
        statusLabel: feedbackStatusLabel(ticket.status),
        createdAt: ticket.createdAt,
        updatedAt: ticket.updatedAt,
        sections: [
          {
            title: 'Ticket Details',
            rows: [
              ['Category', feedbackCategoryLabel(ticket.category)],
              ['Area', feedbackAreaLabel(ticket.area)],
              ['Priority', ticket.priority],
              ['Rating', typeof ticket.rating === 'number' ? `${ticket.rating} / 5` : ''],
              ['Tenant', ticket.tenantName ?? ''],
              ['Reporter', `${ticket.reporterName} (${ticket.reporterEmail})`],
              ['Assigned to', ticket.assignedAdminName ?? 'Unassigned'],
              ['Page URL', ticket.pageUrl ?? ''],
              ['Description', ticket.description],
              ['Internal Notes', ticket.internalNotes ?? ''],
            ],
          },
        ],
        timeline: comments.map((c) => ({
          when: formatFeedbackTime(c.createdAt),
          who: c.authorName || '—',
          what:
            c.eventType === 'status_change'
              ? `Status changed to ${feedbackStatusLabel(c.newStatus ?? '')}`
              : (c.isInternal ? '[Internal] ' : '') + (c.body ?? ''),
        })),
      });
    } catch (err) {
      setExportPdfError(apiErrorMessage(err, 'Failed to export PDF.'));
    } finally {
      setExportingPdf(false);
    }
  }

  if (detailQ.isLoading) return <div className="p-6"><Spinner label="Loading ticket…" /></div>;
  if (detailQ.isError || !detailQ.data) {
    return <div className="p-6"><ErrorNote>{apiErrorMessage(detailQ.error, 'Failed to load feedback ticket.')}</ErrorNote></div>;
  }

  const { ticket } = detailQ.data;

  return (
    <div className="p-4 sm:p-6 3xl:p-10 4xl:p-14">
      <button
        type="button"
        onClick={() => navigate('/platform/feedback')}
        className="mb-4 flex items-center gap-1.5 text-xs font-medium text-stone-500 transition-colors hover:text-stone-800 dark:hover:text-stone-200"
      >
        <ArrowLeft className="size-3.5" />
        Back to Support Tickets
      </button>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">{ticket.ticketNumber}</h1>
            <span className={cn('rounded-full px-2 py-0.5 text-2xs font-semibold', FEEDBACK_STATUS_COLORS[ticket.status as FeedbackStatus])}>
              {feedbackStatusLabel(ticket.status)}
            </span>
            {typeof ticket.rating === 'number' && ticket.rating > 0 && (
              <span className="inline-flex items-center gap-0.5 text-xs text-amber-500">
                <Star className="size-3 fill-amber-400" />{ticket.rating}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
            {feedbackCategoryLabel(ticket.category)}
            {ticket.area && ` · ${feedbackAreaLabel(ticket.area)}`} · {ticket.tenantName} · reported by {ticket.reporterName} ({ticket.reporterEmail}) · {formatFeedbackTime(ticket.createdAt)}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 border-t border-stone-100 pt-4 dark:border-white/10 lg:grid-cols-[1fr_320px]">
        <FeedbackDetailTimeline detail={detailQ.data} />
        <FeedbackDetailSidebar
          ticket={ticket}
          assigneeCandidates={assigneeCandidates}
          onExportPdf={() => void handleExportPdf()}
          exportingPdf={exportingPdf}
          exportPdfError={exportPdfError}
        />
      </div>
    </div>
  );
}
