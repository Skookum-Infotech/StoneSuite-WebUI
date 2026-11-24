import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Inbox, Pencil, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { creditMemoService } from '@/services/creditMemoService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { CREDIT_MEMO_STATUS_COLORS } from '@/lib/creditMemoForm';
import { exportPagedCsv, fmtCsvDate } from '@/lib/csvExport';
import type { CreditMemoSearchRequest } from '@/types/creditMemo';
import { formatDateValue, LIST_DATE_OPTIONS } from '@/lib/dateUtils';
import { CustomerLink } from '@/components/crm/CustomerLink';
import { SortIcon } from '@/components/ui/SortIcon';
import { useListUrlState } from '@/hooks/useListUrlState';

import { buttonVariants } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/StatusPill';
const EXPORT_PAGE_SIZE = 200;

// Credit Memos are a dedicated relational module, not a generic CRM/JSONB
// workflow record, so this table talks to creditMemoService
// (/api/tenant/credit-memos*) directly rather than reusing CrmRecordTable/
// crmService. Mirrors InvoiceTable/PaymentTable's search/sort/cursor-
// pagination UX for visual consistency.

type SortField = 'createdAt' | 'creditMemoDate' | 'grandTotal' | 'unappliedAmount';

const PAGE_SIZE = 25;

const SORT_LABELS: Record<SortField, string> = {
  createdAt: 'Date Created',
  creditMemoDate: 'Credit Memo Date',
  grandTotal: 'Grand Total',
  unappliedAmount: 'Unapplied',
};

const SORT_FIELDS = Object.keys(SORT_LABELS) as SortField[];

const SORT_KEY: Record<SortField, string> = {
  createdAt: 'created_at',
  creditMemoDate: 'credit_memo_date',
  grandTotal: 'grand_total',
  unappliedAmount: 'unapplied_amount',
};

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function CreditMemoTable() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('credit_memo', 'update');

  const { search: debounced, sortBy, sortDir, setSearch: setDebounced, setSort } = useListUrlState<SortField>({
    sortFields: SORT_FIELDS,
    defaultSort: { field: 'createdAt', dir: 'desc' },
  });
  const [term, setTerm] = useState(debounced);

  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(term.trim());
      setCursor('');
      setPrevCursors([]);
    }, 300);
    return () => clearTimeout(t);
  }, [term, setDebounced]);

  const req: CreditMemoSearchRequest = {
    search: debounced || undefined,
    sort: [{ field: SORT_KEY[sortBy], dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['creditMemos', req],
    queryFn: () => creditMemoService.searchCreditMemos(req),
    placeholderData: (prev) => prev,
  });

  const records = data?.records ?? [];
  const hasMore = data?.hasMore ?? false;
  const hasPrev = prevCursors.length > 0;
  const pageNum = prevCursors.length + 1;

  function scrollToTop() {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function goNext() {
    if (!data?.nextCursor) return;
    setPrevCursors((p) => [...p, cursor]);
    setCursor(data.nextCursor);
    scrollToTop();
  }

  function goPrev() {
    const prev = prevCursors[prevCursors.length - 1] ?? '';
    setPrevCursors((p) => p.slice(0, -1));
    setCursor(prev);
    scrollToTop();
  }

  const hasFilters = Boolean(term);

  function clearFilters() {
    setTerm('');
    setCursor('');
    setPrevCursors([]);
  }

  function handleSort(field: SortField) {
    setSort(field, sortBy === field ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc');
    setCursor('');
    setPrevCursors([]);
  }

  async function handleDownloadCsv() {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportPagedCsv(
        (exportCursor) => creditMemoService.searchCreditMemos({ ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor }),
        ['Credit Memo #', 'Date', 'Customer', 'Status', 'Reason', 'Grand Total', 'Applied Total', 'Unapplied Amount'],
        (cm) => [
          cm.creditMemoNumber ?? '',
          fmtCsvDate(cm.creditMemoDate),
          cm.customer?.name ?? '',
          cm.status ?? '',
          cm.reason ?? '',
          String(cm.grandTotal ?? 0),
          String(cm.appliedTotal ?? 0),
          String(cm.unappliedAmount ?? 0),
        ],
        'Credit Memo',
      );
    } catch (err) {
      setExportError(apiErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div ref={topRef} className="flex flex-col gap-3 scroll-mt-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-faint" />
          <input
            type="text"
            placeholder="Search credit memo #, customer, reason…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150 type-input"
          />
        </div>

        <div className="h-5 w-px bg-stone-200" aria-hidden="true" />

        <div className="flex items-center gap-1.5">
          <span className="pr-0.5 type-overline">Sort:</span>
          {(Object.entries(SORT_LABELS) as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-micro font-semibold transition-colors',
                sortBy === field
                  ? 'bg-accent text-accent-foreground ring-1 ring-accent-foreground/20'
                  : 'bg-white border border-stone-200 text-ink-muted hover:border-stone-300 hover:text-ink',
              )}
            >
              {label}
              <SortIcon active={sortBy === field} dir={sortDir} />
            </button>
          ))}
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            className={cn(buttonVariants({ variant: 'outline' }), 'flex')}
          >
            <X className="size-3" />
            Clear
          </button>
        )}

        {records.length > 0 && (
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={isExporting}
            aria-label={hasFilters ? 'Download filtered credit memos as CSV' : 'Download all credit memos as CSV'}
            className={cn(buttonVariants({ variant: 'outline' }), 'ml-auto flex')}
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : hasFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        )}
      </div>

      {isError && (
        <p className="type-error">Failed to load credit memos. Please try again.</p>
      )}
      {exportError && (
        <p className="type-error">Failed to export CSV: {exportError}</p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full sm:min-w-[820px] text-left type-cell">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 max-sm:px-2 py-3 type-th">Credit Memo #</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">Date</th>
                <th className="px-4 max-sm:px-2 py-3 type-th">Customer</th>
                <th className="px-4 max-sm:px-2 py-3 type-th">Status</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">Reason</th>
                <th className="px-4 max-sm:px-2 py-3 text-right type-th">Grand Total</th>
                <th className="px-4 max-sm:px-2 py-3 text-right max-sm:hidden type-th">Applied Total</th>
                <th className="px-4 max-sm:px-2 py-3 text-right max-sm:hidden type-th">Unapplied Amount</th>
                {canEdit && (
                  <th className="px-4 max-sm:px-2 py-3 text-right max-sm:hidden type-th">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <td className="px-4 max-sm:px-2 py-2.5"><div className="animate-pulse h-3 rounded bg-stone-100 w-20" /></td>
                    <td className="px-4 max-sm:px-2 py-2.5 max-sm:hidden"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    <td className="px-4 max-sm:px-2 py-2.5"><div className="animate-pulse h-3 rounded bg-stone-100 w-36" /></td>
                    <td className="px-4 max-sm:px-2 py-2.5"><div className="animate-pulse h-3 rounded bg-stone-100 w-20" /></td>
                    <td className="px-4 max-sm:px-2 py-2.5 max-sm:hidden"><div className="animate-pulse h-3 rounded bg-stone-100 w-24" /></td>
                    <td className="px-4 max-sm:px-2 py-2.5"><div className="animate-pulse h-3 rounded bg-stone-100 w-16 ml-auto" /></td>
                    <td className="px-4 max-sm:px-2 py-2.5 max-sm:hidden"><div className="animate-pulse h-3 rounded bg-stone-100 w-16 ml-auto" /></td>
                    <td className="px-4 max-sm:px-2 py-2.5 max-sm:hidden"><div className="animate-pulse h-3 rounded bg-stone-100 w-16 ml-auto" /></td>
                    {canEdit && <td className="px-4 max-sm:px-2 py-2.5 max-sm:hidden" />}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((cm) => {
                  const color = CREDIT_MEMO_STATUS_COLORS[cm.status] ?? '#a8a29e';
                  return (
                    <tr key={cm.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 max-sm:px-2 py-2.5">
                        <Link
                          to={`/sales/credit_memo/${cm.id}`}
                          className="whitespace-nowrap hover:text-accent-foreground transition-colors type-record-id"
                        >
                          {cm.creditMemoNumber || '—'}
                        </Link>
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 tabular-nums whitespace-nowrap max-sm:hidden type-cell">
                        {cm.creditMemoDate
                          ? formatDateValue(cm.creditMemoDate, undefined, LIST_DATE_OPTIONS)
                          : '—'}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 truncate max-w-[200px] type-cell-strong">
                        {cm.customer?.name ? <CustomerLink id={cm.customer.id} name={cm.customer.name} className="hover:text-accent-foreground hover:underline" /> : '—'}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5">
                        <StatusPill color={color}>{cm.status}</StatusPill>
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 truncate max-w-[160px] max-sm:hidden type-cell">
                        {cm.reason || <span className="text-ink-muted">—</span>}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 tabular-nums text-right whitespace-nowrap type-cell-strong">
                        {currency(cm.grandTotal)}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 tabular-nums text-right whitespace-nowrap max-sm:hidden type-cell">
                        {currency(cm.appliedTotal)}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 tabular-nums text-right whitespace-nowrap max-sm:hidden type-cell">
                        {currency(cm.unappliedAmount)}
                      </td>
                      {canEdit && (
                        <td className="px-4 max-sm:px-2 py-2.5 text-right max-sm:hidden">
                          <button
                            type="button"
                            onClick={() => navigate(`/sales/credit_memo/${cm.id}/edit`)}
                            aria-label={`Edit credit memo ${cm.creditMemoNumber}`}
                            className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-ink-muted transition-colors hover:bg-accent hover:border-accent hover:text-accent-foreground cursor-pointer"
                          >
                            <Pencil className="size-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={8 + (canEdit ? 1 : 0)} className="py-16 text-center">
                    {!hasFilters ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Inbox className="size-6 text-ink-faint" />
                        </div>
                        <p className="type-card-title">No credit memos added yet.</p>
                        <p className="type-helper">Create your first credit memo to get started.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-ink-faint" />
                        </div>
                        <p className="type-card-title">No credit memos match the current search.</p>
                        <p className="type-helper">Try adjusting your search terms.</p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {records.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/40">
            <p className="tabular-nums type-helper">
              Page {pageNum}{hasMore ? '' : ' · last page'}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={goPrev}
                disabled={!hasPrev}
                className={cn(buttonVariants({ variant: 'outline' }), 'flex')}
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5" />
                Previous
              </button>
              <button
                onClick={goNext}
                disabled={!hasMore}
                className={cn(buttonVariants({ variant: 'outline' }), 'flex')}
                aria-label="Next page"
              >
                Next
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
