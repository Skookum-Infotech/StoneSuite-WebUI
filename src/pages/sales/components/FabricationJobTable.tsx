import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, X, Inbox,
  ChevronLeft, ChevronRight, Download, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { fabricationService } from '@/services/fabricationService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { exportPagedCsv, fmtCsvDate } from '@/lib/csvExport';
import { FabricationStatusControl } from './FabricationStatusControl';
import { ReadOnlyStatusPill } from './ReadOnlyStatusPill';
import { FJ_STATUS_COLORS } from '@/lib/fabricationForm';
import type { FabricationJobSearchRequest } from '@/types/fabrication';
import { formatDateValue, LIST_DATE_OPTIONS } from '@/lib/dateUtils';
import { CustomerLink } from '@/components/crm/CustomerLink';

import { buttonVariants } from '@/components/ui/button';
const EXPORT_PAGE_SIZE = 200;

// Fabrication Jobs are a dedicated relational module, not a generic CRM/JSONB
// workflow record, so — mirroring SalesOrderTable — this talks to
// fabricationService (/api/tenant/fabrication-jobs*) directly. Sort fields
// are limited to what the backend resolver actually supports (created_at,
// updated_at, record_number, promised_install_date) — status is deliberately
// not sortable server-side.

type SortField = 'createdAt' | 'promisedInstallDate' | 'updatedAt';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

const SORT_LABELS: Record<SortField, string> = {
  createdAt: 'Date Created',
  promisedInstallDate: 'Promised Install',
  updatedAt: 'Last Updated',
};

const SORT_KEY: Record<SortField, string> = {
  createdAt: 'created_at',
  promisedInstallDate: 'promised_install_date',
  updatedAt: 'updated_at',
};

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return formatDateValue(iso, undefined, LIST_DATE_OPTIONS);
}

export function FabricationJobTable() {
  const queryClient = useQueryClient();
  const topRef = useRef<HTMLDivElement>(null);

  const { isSuperAdmin } = useUserPermissions();

  // Inline status change from the list row's status pill, super admin only —
  // everyone else sees a read-only pill and moves a job from its Detail page.
  // Mirrors the Edit page's transition mutation. Forward-path moves only, same
  // boundary as FabricationStatusControl everywhere else.
  const transition = useMutation({
    mutationFn: (vars: { id: string; toStatusCode: string }) => fabricationService.transition(vars.id, vars.toStatusCode),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['fabrication-job', updated.id] });
      queryClient.invalidateQueries({ queryKey: ['fabrication-jobs'] });
    },
  });

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
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

  const req: FabricationJobSearchRequest = {
    search: debounced || undefined,
    sort: [{ field: SORT_KEY[sortBy], dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['fabrication-jobs', req],
    queryFn: () => fabricationService.searchJobs(req),
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
        (exportCursor) => fabricationService.searchJobs({ ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor }),
        ['Job #', 'Customer', 'Status', 'Promised Install', 'Created'],
        (job) => [
          job.jobNumber ?? '',
          job.customer?.name ?? '',
          job.status ?? '',
          fmtCsvDate(job.promisedInstallDate),
          fmtCsvDate(job.createdAt),
        ],
        'Fabrication Job',
      );
    } catch (err) {
      setExportError(apiErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div ref={topRef} className="flex flex-col gap-3 scroll-mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search job #, site contact, notes…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150 type-input"
          />
        </div>

        <div className="hidden h-5 w-px bg-stone-200 sm:block" aria-hidden="true" />

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="pr-0.5 type-overline">Sort:</span>
          {(Object.entries(SORT_LABELS) as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-micro font-semibold transition-colors',
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
            aria-label={hasFilters ? 'Download filtered fabrication jobs as CSV' : 'Download all fabrication jobs as CSV'}
            className={cn(buttonVariants({ variant: 'outline' }), 'ml-auto flex')}
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : hasFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        )}
      </div>

      {isError && (
        <p className="type-error">Failed to load fabrication jobs. Please try again.</p>
      )}
      {exportError && (
        <p className="type-error">Failed to export CSV: {exportError}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full sm:min-w-[640px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 max-sm:px-2 py-3 type-th">Job #</th>
                <th className="px-4 max-sm:px-2 py-3 type-th">Customer</th>
                <th className="px-4 max-sm:px-2 py-3 type-th">Status</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">Promised Install</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <td className="px-4 max-sm:px-2 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-24" /></td>
                    <td className="px-4 max-sm:px-2 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-36" /></td>
                    <td className="px-4 max-sm:px-2 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-24" /></td>
                    <td className="px-4 max-sm:px-2 py-3 max-sm:hidden"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    <td className="px-4 max-sm:px-2 py-3 max-sm:hidden"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((job) => {
                  return (
                    <tr key={job.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 max-sm:px-2 py-3.5">
                        <Link
                          to={`/sales/installation/${job.id}`}
                          className="whitespace-nowrap hover:text-accent-foreground transition-colors type-record-id"
                        >
                          {job.jobNumber || '—'}
                        </Link>
                      </td>
                      <td className="px-4 max-sm:px-2 py-3.5 truncate max-w-[200px] type-cell-strong">
                        {job.customer?.name ? <CustomerLink id={job.customer.id} name={job.customer.name} className="hover:text-accent-foreground hover:underline" /> : '—'}
                      </td>
                      <td className="px-4 max-sm:px-2 py-3.5">
                        {isSuperAdmin ? (
                          <FabricationStatusControl
                            job={job}
                            onChange={(code) => transition.mutate({ id: job.id, toStatusCode: code })}
                            disabled={transition.isPending && transition.variables?.id === job.id}
                            variant="pill"
                          />
                        ) : (
                          <ReadOnlyStatusPill label={job.status} color={FJ_STATUS_COLORS[job.status]} />
                        )}
                      </td>
                      <td className="px-4 max-sm:px-2 py-3.5 tabular-nums whitespace-nowrap max-sm:hidden type-cell">
                        {fmtDate(job.promisedInstallDate)}
                      </td>
                      <td className="px-4 max-sm:px-2 py-3.5 tabular-nums whitespace-nowrap max-sm:hidden type-cell">
                        {fmtDate(job.createdAt)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="py-16 text-center">
                    {!hasFilters ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Inbox className="size-6 text-stone-400" />
                        </div>
                        <p className="type-card-title">No fabrication jobs yet.</p>
                        <p className="type-helper">Create one from a sales order to get started.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-stone-400" />
                        </div>
                        <p className="type-card-title">No fabrication jobs match the current search.</p>
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
          <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-t border-stone-100 bg-stone-50/40">
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
