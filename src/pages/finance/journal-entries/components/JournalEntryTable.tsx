import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, X, ArrowLeftRight, Pencil, Filter,
  ChevronLeft, ChevronRight, Download, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { journalEntryService } from '@/services/journalEntryService';
import { lookupService } from '@/services/lookupService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { JE_STATUS_COLORS, JE_EDITABLE_STATUSES } from '@/lib/journalEntryForm';
import { exportPagedCsv, fmtCsvDate } from '@/lib/csvExport';
import {
  EMPTY_FILTER_STATE, hasActiveFilters, toFilterClauses, type JournalEntryFilterState,
} from '@/lib/journalEntryFilters';
import { JournalEntryFilterDrawer } from './JournalEntryFilterDrawer';
import type { JournalEntrySearchRequest } from '@/types/journalEntry';

const EXPORT_PAGE_SIZE = 200;

// Journal Entry is a dedicated relational module (the backend calls it
// "cash transfer"), not a generic CRM/JSONB workflow record — mirrors
// ItemReceiptTable's search/sort/cursor-pagination UX and filter drawer.
// `status` is filter-only server-side and compares against an internal
// integer id there's no lookup for, so it's a display column here, never a
// sort/filter chip (mirrors ItemReceiptTable's identical omission).

type SortField = 'recordNumber' | 'transferDate' | 'amount';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

const SORT_LABELS: Record<SortField, string> = {
  recordNumber: 'Journal Entry #',
  transferDate: 'Date',
  amount: 'Amount',
};

const SORT_KEY: Record<SortField, string> = {
  recordNumber: 'record_number',
  transferDate: 'transfer_date',
  amount: 'amount',
};

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' });
}

function currency(n: number): string {
  return n.toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function JournalEntryTable() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('cash_transfer', 'update');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('transferDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filters, setFilters] = useState<JournalEntryFilterState>(EMPTY_FILTER_STATE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });
  const employeeNames = new Map((lookups?.employees ?? []).map((e) => [String(e.id), e.name]));

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(term.trim());
      setCursor('');
      setPrevCursors([]);
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const req: JournalEntrySearchRequest = {
    search: debounced || undefined,
    filters: toFilterClauses(filters),
    sort: [{ field: SORT_KEY[sortBy], dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['journal-entries', req],
    queryFn: () => journalEntryService.searchJournalEntries(req),
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

  const filtersActive = hasActiveFilters(filters);
  const hasFilters = Boolean(term) || filtersActive;

  function clearFilters() {
    setTerm('');
    setFilters(EMPTY_FILTER_STATE);
    setCursor('');
    setPrevCursors([]);
  }

  function applyFilters(next: JournalEntryFilterState) {
    setFilters(next);
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
        (exportCursor) => journalEntryService.searchJournalEntries({ ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor }),
        ['Journal Entry #', 'Status', 'Date', 'From Account', 'To Account', 'Amount', 'Reference', 'Owner'],
        (je) => [
          je.transferNumber ?? '',
          je.status ?? '',
          fmtCsvDate(je.transferDate),
          je.fromAccount ? `${je.fromAccount.code} — ${je.fromAccount.name}` : '',
          je.toAccount ? `${je.toAccount.code} — ${je.toAccount.name}` : '',
          String(je.amount ?? ''),
          je.reference ?? '',
          (je.ownerEmployeeId ? employeeNames.get(String(je.ownerEmployeeId)) : undefined) ?? '',
        ],
        'Journal Entry',
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
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search entry #, reference, notes…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150"
          />
        </div>

        <button
          onClick={() => setFiltersOpen(true)}
          className={cn(
            'flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors',
            filtersActive
              ? 'border-brand/40 bg-accent text-accent-foreground'
              : 'border-stone-200 bg-white text-stone-500 hover:bg-stone-50',
          )}
        >
          <Filter className="size-3.5" />
          Filters
        </button>

        <div className="h-5 w-px bg-stone-200" aria-hidden="true" />

        <div className="flex items-center gap-1.5">
          <span className="text-2xs font-semibold uppercase tracking-wider text-stone-400 pr-0.5">Sort:</span>
          {(Object.entries(SORT_LABELS) as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
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
            className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs text-stone-500 hover:bg-stone-50 transition-colors"
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
            aria-label={hasFilters ? 'Download filtered journal entries as CSV' : 'Download all journal entries as CSV'}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : hasFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        )}
      </div>

      {isError && (
        <p className="text-xs text-red-500">{apiErrorMessage(error, 'Failed to load journal entries. Please try again.')}</p>
      )}
      {exportError && (
        <p className="text-xs text-red-500">Failed to export CSV: {exportError}</p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[960px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Journal Entry #</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Date</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">From Account</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">To Account</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Amount</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Reference</th>
                {canEdit && (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: canEdit ? 8 : 7 }, (_, j) => (
                      <td key={j} className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    ))}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((je) => {
                  const color = JE_STATUS_COLORS[je.statusCode] ?? '#a8a29e';
                  const editable = canEdit && JE_EDITABLE_STATUSES.has(je.statusCode);
                  return (
                    <tr key={je.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/finance/journal-entries/${je.id}`)}
                          className="font-mono text-xs font-semibold text-stone-900 hover:text-accent-foreground transition-colors"
                        >
                          {je.transferNumber || '—'}
                        </button>
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-stone-600 whitespace-nowrap"
                          style={{ backgroundColor: `${color}18` }}
                        >
                          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                          {je.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-400 tabular-nums whitespace-nowrap">
                        {fmtDate(je.transferDate)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-700 truncate max-w-[180px]">
                        {je.fromAccount ? `${je.fromAccount.code} — ${je.fromAccount.name}` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-700 truncate max-w-[180px]">
                        {je.toAccount ? `${je.toAccount.code} — ${je.toAccount.name}` : '—'}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-800 font-semibold tabular-nums text-right whitespace-nowrap">
                        {currency(je.amount)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-500 truncate max-w-[140px]">
                        {je.reference || '—'}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3.5 text-right">
                          {editable && (
                            <button
                              type="button"
                              onClick={() => navigate(`/finance/journal-entries/${je.id}/edit`)}
                              aria-label={`Edit journal entry ${je.transferNumber}`}
                              className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-500 transition-colors hover:bg-accent hover:border-accent hover:text-accent-foreground cursor-pointer"
                            >
                              <Pencil className="size-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7 + (canEdit ? 1 : 0)} className="py-16 text-center">
                    {!hasFilters ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <ArrowLeftRight className="size-6 text-stone-400" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700">No journal entries added yet.</p>
                        <p className="text-xs text-stone-400">Transfer funds between two Bank/Cash accounts to get started.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-stone-400" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700">No journal entries match the current search.</p>
                        <p className="text-xs text-stone-400">Try adjusting your search or filters.</p>
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
                <ChevronLeft className="size-3.5" />
                Previous
              </button>
              <button
                onClick={goNext}
                disabled={!hasMore}
                className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                aria-label="Next page"
              >
                Next
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {filtersOpen && (
        <JournalEntryFilterDrawer
          onClose={() => setFiltersOpen(false)}
          value={filters}
          onApply={applyFilters}
        />
      )}
    </div>
  );
}
