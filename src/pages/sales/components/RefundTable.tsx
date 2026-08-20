import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, X, Inbox, Pencil,
  ChevronLeft, ChevronRight, Download, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { refundService } from '@/services/refundService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { RefundStatusControl } from './RefundStatusControl';
import { exportPagedCsv, fmtCsvDate } from '@/lib/csvExport';
import type { RefundSearchRequest } from '@/types/refund';

const EXPORT_PAGE_SIZE = 200;

// Refunds are a dedicated relational module, not a generic CRM/JSONB workflow
// record, so — like Payment — this table talks to refundService
// (/api/tenant/refunds*) directly rather than reusing CrmRecordTable/
// crmService. Mirrors PaymentTable's search/sort/cursor-pagination UX.

// Keys must match refund/resolver.go's sortFields whitelist — a key outside it
// is a 400, not a silently ignored sort.
type SortField = 'refund_date' | 'amount' | 'unapplied_amount';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

const SORT_LABELS: Record<SortField, string> = {
  refund_date: 'Refund Date',
  amount: 'Amount',
  unapplied_amount: 'Unapplied',
};

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function RefundTable() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const topRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('refund', 'update');

  // Inline status change from the list row's status pill — mirrors the Edit
  // page's transition mutation.
  const transition = useMutation({
    mutationFn: (vars: { id: string; toStatusCode: string }) => refundService.transition(vars.id, vars.toStatusCode),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['refund', updated.id] });
      queryClient.invalidateQueries({ queryKey: ['refunds'] });
    },
  });

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('refund_date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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
  }, [term]);

  const req: RefundSearchRequest = {
    search: debounced || undefined,
    sort: [{ field: sortBy, dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, error } = useQuery({
    queryKey: ['refunds', req],
    queryFn: () => refundService.searchRefunds(req),
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
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    setCursor('');
    setPrevCursors([]);
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <ArrowUpDown className="size-2.5 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />;
  }

  async function handleDownloadCsv() {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportPagedCsv(
        (exportCursor) => refundService.searchRefunds({ ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor }),
        ['Refund #', 'Customer', 'Status', 'Refund Date', 'Amount', 'Unapplied'],
        (r) => [
          r.refundNumber ?? '',
          r.customer?.name ?? '',
          r.status ?? '',
          fmtCsvDate(r.refundDate),
          String(r.amount ?? 0),
          String(r.unappliedAmount ?? 0),
        ],
        'Refund',
      );
    } catch (err) {
      setExportError(apiErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  }

  const columnCount = 6 + (canEdit ? 1 : 0);

  return (
    <div ref={topRef} className="flex flex-col gap-3 scroll-mt-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" aria-hidden="true" />
          <input
            type="text"
            placeholder="Search refund #, customer, reference…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="Search refunds"
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150"
          />
        </div>

        <div className="h-5 w-px bg-stone-200" aria-hidden="true" />

        <div className="flex items-center gap-1.5">
          <span className="text-2xs font-semibold uppercase tracking-wider text-stone-400 pr-0.5">Sort:</span>
          {(Object.entries(SORT_LABELS) as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              aria-label={`Sort by ${label}`}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-2xs font-semibold transition-colors',
                sortBy === field
                  ? 'bg-accent text-accent-foreground ring-1 ring-accent-foreground/20'
                  : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700',
              )}
            >
              {label}
              <SortIcon field={field} />
            </button>
          ))}
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            aria-label="Clear search"
            className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs text-stone-500 hover:bg-stone-50 transition-colors"
          >
            <X className="size-3" aria-hidden="true" />
            Clear
          </button>
        )}

        {records.length > 0 && (
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={isExporting}
            aria-label={hasFilters ? 'Download filtered refunds as CSV' : 'Download all refunds as CSV'}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> : <Download className="size-3.5" aria-hidden="true" />}
            {isExporting ? 'Exporting…' : hasFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        )}
      </div>

      {/* A 400 here means an invalid filter/sort key (refund/resolver.go's
          whitelist), and the server names the offending field — surface that
          message rather than flattening it into "try again", which would hide
          a real, actionable contract error behind what looks like a blip. */}
      {error && (
        <p role="alert" className="text-xs text-red-500">
          {apiErrorMessage(error, 'Failed to load refunds. Please try again.')}
        </p>
      )}
      {exportError && (
        <p role="alert" className="text-xs text-red-500">Failed to export CSV: {exportError}</p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Refund #</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Customer</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Refund Date</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Amount</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Unapplied</th>
                {canEdit && (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-20" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-36" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-20" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16 ml-auto" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16 ml-auto" /></td>
                    {canEdit && <td className="px-4 py-3" />}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((r) => {
                  return (
                    <tr key={r.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/sales/refund/${r.id}`)}
                          className="font-mono text-xs font-semibold text-stone-900 hover:text-accent-foreground transition-colors"
                        >
                          {r.refundNumber || '—'}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-700 truncate max-w-[200px]">
                        {r.customer?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <RefundStatusControl
                          refund={{ statusCode: r.statusCode, approvalStatus: r.approvalStatus ?? 'none' }}
                          onChange={(code) => transition.mutate({ id: r.id, toStatusCode: code })}
                          disabled={transition.isPending && transition.variables?.id === r.id}
                          variant="pill"
                        />
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-400 tabular-nums whitespace-nowrap">
                        {r.refundDate
                          ? new Date(r.refundDate).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-stone-900 tabular-nums text-right whitespace-nowrap">
                        {currency(r.amount)}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-medium text-stone-600 tabular-nums text-right whitespace-nowrap">
                        {currency(r.unappliedAmount)}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/sales/refund/${r.id}/edit`)}
                            aria-label={`Edit refund ${r.refundNumber}`}
                            className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-500 transition-colors hover:bg-accent hover:border-accent hover:text-accent-foreground cursor-pointer"
                          >
                            <Pencil className="size-4" aria-hidden="true" />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={columnCount} className="py-16 text-center">
                    {!hasFilters ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Inbox className="size-6 text-stone-400" aria-hidden="true" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700">No refunds recorded yet.</p>
                        <p className="text-xs text-stone-400">Record your first refund to get started.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-stone-400" aria-hidden="true" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700">No refunds match the current search.</p>
                        <p className="text-xs text-stone-400">Try adjusting your search terms.</p>
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
            <p className="text-xs text-stone-500 tabular-nums">
              Page {pageNum}{hasMore ? '' : ' · last page'}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={goPrev}
                disabled={!hasPrev}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Previous page"
              >
                <ChevronLeft className="size-3.5" aria-hidden="true" />
                Previous
              </button>
              <button
                onClick={goNext}
                disabled={!hasMore}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                Next
                <ChevronRight className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
