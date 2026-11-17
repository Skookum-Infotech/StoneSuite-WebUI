import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, X, Inbox, Pencil, Filter,
  ChevronLeft, ChevronRight, ShieldCheck, Download, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { expenseService } from '@/services/expenseService';
import { lookupService } from '@/services/lookupService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { exportPagedCsv, fmtCsvDate } from '@/lib/csvExport';
import {
  EMPTY_FILTER_STATE, hasActiveFilters, toFilterClauses, type ExpenseFilterState,
} from '@/lib/expenseFilters';
import { ExpenseFilterDrawer } from './ExpenseFilterDrawer';
import { ExpenseStatusControl } from './ExpenseStatusControl';
import { ReadOnlyStatusPill } from '@/pages/sales/components/ReadOnlyStatusPill';
import { EXPENSE_STATUS_COLORS } from '@/lib/expenseForm';
import type { ExpenseSearchRequest } from '@/types/expense';

import { buttonVariants } from '@/components/ui/button';
// Columns still shown below the sm breakpoint (indexes into the header row); the rest return from sm up.
const PHONE_COLUMNS = new Set([0, 1, 3, 5]);

const EXPORT_PAGE_SIZE = 200;
const PAGE_SIZE = 25;

// Expenses are a dedicated relational module, not a generic CRM/JSONB
// workflow record, so — like Requisition/Purchase Order — this table talks to
// expenseService (/api/tenant/expenses*) directly rather than reusing
// CrmRecordTable/crmService. Mirrors RequisitionTable's search/sort/
// cursor-pagination UX.

// Only fields in expense/resolver.go's `sortableFields` (plus the engine's
// built-in created_at) are offered.
type SortField = 'recordNumber' | 'total' | 'status' | 'createdAt';
type SortDir = 'asc' | 'desc';

const SORT_LABELS: Record<SortField, string> = {
  recordNumber: 'Expense #',
  total: 'Amount',
  status: 'Status',
  createdAt: 'Created',
};

const SORT_KEY: Record<SortField, string> = {
  recordNumber: 'record_number',
  total: 'total',
  status: 'status',
  createdAt: 'created_at',
};

const APPROVAL_LABELS: Record<string, string> = {
  pending: 'Pending Approval',
  approved: 'Approved',
};
const APPROVAL_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#22c55e',
};

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

export function ExpenseTable() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const topRef = useRef<HTMLDivElement>(null);

  // Inline status change from the list row's status pill — mirrors the
  // Detail page's transition mutation (see ExpenseDetailPage.tsx).
  const transition = useMutation({
    mutationFn: (vars: { id: string; toStatusCode: string }) => expenseService.transition(vars.id, vars.toStatusCode),
    onSuccess: (updated) => {
      queryClient.setQueryData(['expense', updated.id], updated);
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
  });

  const { hasPermission, isSuperAdmin, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('expense', 'update');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('recordNumber');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filters, setFilters] = useState<ExpenseFilterState>(EMPTY_FILTER_STATE);
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

  const req: ExpenseSearchRequest = {
    search: debounced || undefined,
    filters: toFilterClauses(filters),
    sort: [{ field: SORT_KEY[sortBy], dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['expenses', req],
    queryFn: () => expenseService.searchExpenses(req),
    placeholderData: (prev) => prev,
  });

  const records = data?.records ?? [];
  const hasMore = data?.hasMore ?? false;
  const hasPrev = prevCursors.length > 0;
  const pageNum = prevCursors.length + 1;

  function scrollToTop() {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Cursors are opaque — only ever pass back what the server returned.
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

  function applyFilters(next: ExpenseFilterState) {
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
        (exportCursor) => expenseService.searchExpenses({ ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor }),
        ['Expense #', 'Claimant', 'Department', 'Status', 'Approval', 'Total', 'Created'],
        (exp) => [
          exp.expenseNumber ?? '',
          (exp.claimantEmployeeId ? employeeNames.get(String(exp.claimantEmployeeId)) : undefined) ?? '',
          exp.department ?? '',
          exp.status ?? '',
          APPROVAL_LABELS[exp.approvalStatus] ?? '',
          String(exp.total ?? 0),
          fmtCsvDate(exp.createdAt),
        ],
        'Expense',
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
            placeholder="Search expense #, department, memo…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="Search expenses"
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150 type-input"
          />
        </div>

        <button
          onClick={() => setFiltersOpen(true)}
          aria-label="Open filters"
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
          <span className="pr-0.5 type-overline">Sort:</span>
          {(Object.entries(SORT_LABELS) as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              aria-label={`Sort by ${label}`}
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
            aria-label="Clear search and filters"
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
            aria-label={hasFilters ? 'Download filtered expenses as CSV' : 'Download all expenses as CSV'}
            className={cn(buttonVariants({ variant: 'outline' }), 'ml-auto flex')}
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : hasFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        )}
      </div>

      {/* A 400 here is an invalid filter key, not a generic failure —
          apiErrorMessage surfaces the server's InvalidFilterError text. */}
      {isError && (
        <p className="type-error">{apiErrorMessage(error, 'Failed to load expenses. Please try again.')}</p>
      )}
      {exportError && (
        <p className="type-error">Failed to export CSV: {exportError}</p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full sm:min-w-[860px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 max-sm:px-2 py-3 type-th">Expense #</th>
                <th className="px-4 max-sm:px-2 py-3 type-th">Claimant</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">Department</th>
                <th className="px-4 max-sm:px-2 py-3 type-th">Status</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">Approval</th>
                <th className="px-4 max-sm:px-2 py-3 text-right type-th">Total</th>
                {canEdit && (
                  <th className="px-4 max-sm:px-2 py-3 text-right max-sm:hidden type-th">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: canEdit ? 7 : 6 }, (_, j) => (
                      <td key={j} className={cn('px-4 max-sm:px-2 py-3', !PHONE_COLUMNS.has(j) && 'max-sm:hidden')}><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    ))}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((exp) => {
                  const approvalLabel = APPROVAL_LABELS[exp.approvalStatus];
                  const claimantName = exp.claimantEmployeeId
                    ? employeeNames.get(String(exp.claimantEmployeeId))
                    : undefined;
                  return (
                    <tr key={exp.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 max-sm:px-2 py-3.5">
                        <Link
                          to={`/purchases/expense/${exp.id}`}
                          aria-label={`Open expense ${exp.expenseNumber}`}
                          className="inline-flex items-center gap-1.5 hover:text-accent-foreground transition-colors type-record-id"
                        >
                          {exp.expenseNumber || '—'}
                        </Link>
                      </td>
                      <td className="px-4 max-sm:px-2 py-3.5 truncate max-w-[140px] type-cell">
                        {claimantName ?? '—'}
                      </td>
                      <td className="px-4 max-sm:px-2 py-3.5 truncate max-w-[120px] max-sm:hidden type-cell">
                        {exp.department || '—'}
                      </td>
                      <td className="px-4 max-sm:px-2 py-3.5">
                        {isSuperAdmin ? (
                          <ExpenseStatusControl
                            order={{ statusCode: exp.statusCode, approvalStatus: exp.approvalStatus, nextStatusCodes: exp.nextStatusCodes }}
                            onChange={(code) => transition.mutate({ id: exp.id, toStatusCode: code })}
                            disabled={transition.isPending && transition.variables?.id === exp.id}
                            variant="pill"
                          />
                        ) : (
                          <ReadOnlyStatusPill label={exp.status} color={EXPENSE_STATUS_COLORS[exp.statusCode]} />
                        )}
                      </td>
                      <td className="px-4 max-sm:px-2 py-3.5 max-sm:hidden">
                        {approvalLabel ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 whitespace-nowrap type-pill"
                            style={{ backgroundColor: `${APPROVAL_COLORS[exp.approvalStatus]}18`, color: APPROVAL_COLORS[exp.approvalStatus] }}
                          >
                            <ShieldCheck className="size-2.5" aria-hidden="true" />
                            {approvalLabel}
                          </span>
                        ) : (
                          <span className="type-subline">—</span>
                        )}
                      </td>
                      <td className="px-4 max-sm:px-2 py-3.5 tabular-nums text-right whitespace-nowrap type-cell-strong">
                        {currency(exp.total)}
                      </td>
                      {canEdit && (
                        <td className="px-4 max-sm:px-2 py-3.5 text-right max-sm:hidden">
                          <button
                            type="button"
                            onClick={() => navigate(`/purchases/expense/${exp.id}/edit`)}
                            aria-label={`Edit expense ${exp.expenseNumber}`}
                            className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-500 transition-colors hover:bg-accent hover:border-accent hover:text-accent-foreground cursor-pointer"
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
                          <Inbox className="size-6 text-stone-400" />
                        </div>
                        <p className="type-card-title">No expense claims yet.</p>
                        <p className="type-helper">Create your first expense claim to get started.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-stone-400" />
                        </div>
                        <p className="type-card-title">No expenses match the current search.</p>
                        <p className="type-helper">Try adjusting your search or filters.</p>
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

      {filtersOpen && (
        <ExpenseFilterDrawer
          onClose={() => setFiltersOpen(false)}
          value={filters}
          onApply={applyFilters}
        />
      )}
    </div>
  );
}
