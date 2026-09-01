import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Loader2, MessageSquareText } from 'lucide-react';
import { feedbackAdminService } from '@/services/feedbackAdminService';
import { platformService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { exportPagedCsv, fmtCsvDate } from '@/lib/csvExport';
import { feedbackAreaLabel, feedbackCategoryLabel, feedbackPriorityLabel, feedbackStatusLabel } from '@/lib/feedback';
import { FeedbackStatsTiles } from './components/FeedbackStatsTiles';
import { FeedbackFiltersBar } from './components/FeedbackFiltersBar';
import { FeedbackAdminTable } from './components/FeedbackAdminTable';
import { FeedbackPagination } from './components/FeedbackPagination';
import type { FeedbackAdminFilters } from '@/types/feedback';

const EMPTY_FILTERS: FeedbackAdminFilters = { status: '', category: '', priority: '', tenantId: '', search: '' };
const EXPORT_PAGE_SIZE = 100;

export default function FeedbackListPage() {
  const [filters, setFilters] = useState<FeedbackAdminFilters>(EMPTY_FILTERS);
  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  function resetPaging() {
    setCursor('');
    setPrevCursors([]);
  }

  function updateFilters(patch: Partial<FeedbackAdminFilters>) {
    setFilters((f) => ({ ...f, ...patch }));
    resetPaging();
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    resetPaging();
  }

  const req: FeedbackAdminFilters = { ...filters, cursor };

  const ticketsQ = useQuery({
    queryKey: ['platform-feedback', req],
    queryFn: () => feedbackAdminService.list(req),
    placeholderData: (prev) => prev,
  });

  const statsQ = useQuery({ queryKey: ['platform-feedback-stats'], queryFn: feedbackAdminService.stats });

  const tenantsQ = useQuery({
    queryKey: ['platform-tenants'],
    queryFn: platformService.listTenants,
    staleTime: 5 * 60 * 1000,
  });

  const tickets = ticketsQ.data?.tickets ?? [];
  const hasNext = Boolean(ticketsQ.data?.nextCursor);
  const hasPrev = prevCursors.length > 0;
  const pageNum = prevCursors.length + 1;

  function goNext() {
    if (!ticketsQ.data?.nextCursor) return;
    setPrevCursors((p) => [...p, cursor]);
    setCursor(ticketsQ.data.nextCursor);
  }

  function goPrev() {
    const prev = prevCursors[prevCursors.length - 1] ?? '';
    setPrevCursors((p) => p.slice(0, -1));
    setCursor(prev);
  }

  async function handleDownloadCsv() {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportPagedCsv(
        (exportCursor) =>
          feedbackAdminService
            .list({ ...filters, cursor: exportCursor, limit: EXPORT_PAGE_SIZE })
            .then((page) => ({ records: page.tickets, hasMore: Boolean(page.nextCursor), nextCursor: page.nextCursor })),
        ['Ticket #', 'Tenant', 'Reporter', 'Category', 'Area', 'Description', 'Rating', 'Priority', 'Status', 'Submitted'],
        (t) => [
          t.ticketNumber,
          t.tenantName ?? '',
          t.reporterName || t.reporterEmail,
          feedbackCategoryLabel(t.category),
          feedbackAreaLabel(t.area),
          t.description,
          typeof t.rating === 'number' ? String(t.rating) : '',
          feedbackPriorityLabel(t.priority),
          feedbackStatusLabel(t.status),
          fmtCsvDate(t.createdAt),
        ],
        'Feedback Ticket',
      );
    } catch (err) {
      setExportError(apiErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col p-4 sm:p-6 3xl:p-10 4xl:p-14">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent ring-1 ring-accent-foreground/10">
            <MessageSquareText className="size-5 text-accent-foreground" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-stone-900 dark:text-stone-100">Support Tickets</h1>
            <p className="text-sm text-stone-500 dark:text-stone-400">
              Feedback, bugs, and feature requests reported across every tenant.
            </p>
          </div>
        </div>

        {tickets.length > 0 && (
          <button
            type="button"
            onClick={() => void handleDownloadCsv()}
            disabled={isExporting}
            aria-label="Download tickets matching the current filters as CSV"
            className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-transparent dark:text-stone-300 dark:hover:bg-white/[0.06]"
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : 'Download CSV'}
          </button>
        )}
      </div>

      <div className="mt-5 flex flex-1 flex-col gap-4 border-t border-stone-100 pt-4 dark:border-white/10">
        <FeedbackStatsTiles stats={statsQ.data} />

        <FeedbackFiltersBar filters={filters} tenants={tenantsQ.data ?? []} onChange={updateFilters} onClear={clearFilters} />

        {ticketsQ.isError && (
          <p role="alert" className="text-xs text-destructive">
            {apiErrorMessage(ticketsQ.error, 'Failed to load feedback tickets.')}
          </p>
        )}
        {exportError && <p className="text-xs text-destructive">Failed to export CSV: {exportError}</p>}

        <FeedbackAdminTable tickets={tickets} isLoading={ticketsQ.isLoading} />

        {tickets.length > 0 && (
          <FeedbackPagination pageNum={pageNum} hasNext={hasNext} hasPrev={hasPrev} onNext={goNext} onPrev={goPrev} />
        )}
      </div>
    </div>
  );
}
