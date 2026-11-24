import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, Inbox, Pencil, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { estimateService } from '@/services/estimateService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { EstimateStatusControl } from './EstimateStatusControl';
import { ReadOnlyStatusPill } from './ReadOnlyStatusPill';
import { ESTIMATE_STATUS_COLORS } from '@/lib/estimateForm';
import { exportPagedCsv, fmtCsvDate } from '@/lib/csvExport';
import type { EstimateSearchRequest } from '@/types/estimate';
import { formatDateValue, LIST_DATE_OPTIONS } from '@/lib/dateUtils';
import { CustomerLink } from '@/components/crm/CustomerLink';
import { SortIcon } from '@/components/ui/SortIcon';
import { useListUrlState } from '@/hooks/useListUrlState';

import { buttonVariants } from '@/components/ui/button';
const EXPORT_PAGE_SIZE = 200;

// Estimates are a dedicated relational module, not a generic CRM/JSONB
// workflow record, so — unlike Lead/Prospect/Customer — this table talks to
// estimateService (/api/tenant/estimates*) directly rather than reusing
// CrmRecordTable/crmService. Mirrors InvoiceTable's search/sort/
// cursor-pagination UX for visual consistency.

type SortField = 'createdAt' | 'estimateDate' | 'grandTotal';

const PAGE_SIZE = 25;

const SORT_LABELS: Record<SortField, string> = {
  createdAt: 'Date Created',
  estimateDate: 'Estimate Date',
  grandTotal: 'Amount',
};

const SORT_FIELDS = Object.keys(SORT_LABELS) as SortField[];

const SORT_KEY: Record<SortField, string> = {
  createdAt: 'created_at',
  estimateDate: 'estimate_date',
  grandTotal: 'grand_total',
};

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return formatDateValue(iso, undefined, LIST_DATE_OPTIONS);
}

export function EstimateTable() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const topRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isSuperAdmin, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('estimate', 'update');

  // Inline status change from the list row's status pill, super admin only —
  // everyone else sees a read-only pill and moves an estimate from its Detail
  // page. Mirrors the Edit page's transition mutation.
  const transition = useMutation({
    mutationFn: (vars: { id: string; toStatusCode: string }) => estimateService.transition(vars.id, vars.toStatusCode),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['estimate', updated.id] });
      queryClient.invalidateQueries({ queryKey: ['estimates'] });
    },
  });

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

  const req: EstimateSearchRequest = {
    search: debounced || undefined,
    sort: [{ field: SORT_KEY[sortBy], dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['estimates', req],
    queryFn: () => estimateService.searchEstimates(req),
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
        (exportCursor) => estimateService.searchEstimates({ ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor }),
        ['Estimate #', 'Customer', 'Status', 'Estimate Date', 'Valid Until', 'Amount'],
        (est) => [
          est.estimateNumber ?? '',
          est.customer?.name ?? '',
          est.status ?? '',
          fmtCsvDate(est.estimateDate),
          fmtCsvDate(est.validUntil),
          String(est.grandTotal ?? 0),
        ],
        'Estimate',
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
            placeholder="Search estimate #, customer, PO…"
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
            aria-label={hasFilters ? 'Download filtered estimates as CSV' : 'Download all estimates as CSV'}
            className={cn(buttonVariants({ variant: 'outline' }), 'ml-auto flex')}
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : hasFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        )}
      </div>

      {isError && (
        <p className="type-error">Failed to load estimates. Please try again.</p>
      )}
      {exportError && (
        <p className="type-error">Failed to export CSV: {exportError}</p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full sm:min-w-[680px] text-left type-cell">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 max-sm:px-2 py-3 type-th">Estimate #</th>
                <th className="px-4 max-sm:px-2 py-3 type-th">Customer</th>
                <th className="px-4 max-sm:px-2 py-3 type-th">Status</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">Estimate Date</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">Valid Until</th>
                <th className="px-4 max-sm:px-2 py-3 text-right type-th">Amount</th>
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
                    <td className="px-4 max-sm:px-2 py-2.5"><div className="animate-pulse h-3 rounded bg-stone-100 w-36" /></td>
                    <td className="px-4 max-sm:px-2 py-2.5"><div className="animate-pulse h-3 rounded bg-stone-100 w-20" /></td>
                    <td className="px-4 max-sm:px-2 py-2.5 max-sm:hidden"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    <td className="px-4 max-sm:px-2 py-2.5 max-sm:hidden"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    <td className="px-4 max-sm:px-2 py-2.5"><div className="animate-pulse h-3 rounded bg-stone-100 w-16 ml-auto" /></td>
                    {canEdit && <td className="px-4 max-sm:px-2 py-2.5 max-sm:hidden" />}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((est) => {
                  return (
                    <tr key={est.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 max-sm:px-2 py-2.5">
                        <Link
                          to={`/sales/estimate/${est.id}`}
                          className="whitespace-nowrap hover:text-accent-foreground transition-colors type-record-id"
                        >
                          {est.estimateNumber || '—'}
                        </Link>
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 truncate max-w-[200px] type-cell-strong">
                        {est.customer?.name ? <CustomerLink id={est.customer.id} name={est.customer.name} className="hover:text-accent-foreground hover:underline" /> : '—'}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5">
                        {isSuperAdmin ? (
                          <EstimateStatusControl
                            estimate={est}
                            onChange={(code) => transition.mutate({ id: est.id, toStatusCode: code })}
                            disabled={transition.isPending && transition.variables?.id === est.id}
                            variant="pill"
                          />
                        ) : (
                          <ReadOnlyStatusPill label={est.status} color={ESTIMATE_STATUS_COLORS[est.status]} />
                        )}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 tabular-nums whitespace-nowrap max-sm:hidden type-cell">
                        {fmtDate(est.estimateDate)}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 tabular-nums whitespace-nowrap max-sm:hidden type-cell">
                        {fmtDate(est.validUntil)}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 tabular-nums text-right whitespace-nowrap type-cell-strong">
                        {currency(est.grandTotal)}
                      </td>
                      {canEdit && (
                        <td className="px-4 max-sm:px-2 py-2.5 text-right max-sm:hidden">
                          <button
                            type="button"
                            onClick={() => navigate(`/sales/estimate/${est.id}/edit`)}
                            aria-label={`Edit estimate ${est.estimateNumber}`}
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
                  <td colSpan={6 + (canEdit ? 1 : 0)} className="py-16 text-center">
                    {!hasFilters ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Inbox className="size-6 text-ink-faint" />
                        </div>
                        <p className="type-card-title">No estimates added yet.</p>
                        <p className="type-helper">Create your first estimate to get started.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-ink-faint" />
                        </div>
                        <p className="type-card-title">No estimates match the current search.</p>
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
