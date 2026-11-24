import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Inbox, Pencil, ChevronLeft, ChevronRight, ShieldCheck, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { employeeService } from '@/services/employeeService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { exportPagedCsv, fmtCsvDate } from '@/lib/csvExport';
import { EMPLOYEE_STATUS_CODES, EMPLOYEE_STATUS_COLORS } from '@/lib/employeeForm';
import { ReadOnlyStatusPill } from '@/pages/sales/components/ReadOnlyStatusPill';
import { Select } from '@/components/ui/select';
import { SortIcon } from '@/components/ui/SortIcon';
import { useListUrlState } from '@/hooks/useListUrlState';
import type { EmployeeSearchRequest } from '@/types/employee';

// Columns still shown below the sm breakpoint (indexes into the header row); the rest return from sm up.
const PHONE_COLUMNS = new Set([0, 1, 3]);

const EXPORT_PAGE_SIZE = 200;
const PAGE_SIZE = 25;
const ALL_STATUSES = '';
const LIST_PATH = '/config/employees';

// Only fields in employee/resolver.go's `sortFields` are offered.
type SortField = 'name' | 'recordNumber' | 'status' | 'createdAt';

const SORT_LABELS: Record<SortField, string> = {
  name: 'Name',
  recordNumber: 'Employee #',
  status: 'Status',
  createdAt: 'Created',
};
const SORT_FIELDS = Object.keys(SORT_LABELS) as SortField[];
const SORT_KEY: Record<SortField, string> = {
  name: 'name',
  recordNumber: 'record_number',
  status: 'status',
  createdAt: 'created_at',
};

const APPROVAL_LABELS: Record<string, string> = {
  pending: 'Awaiting approval',
  rejected: 'Rejected',
};
const APPROVAL_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  rejected: '#ef4444',
};

const COLUMN_COUNT = 6;

// Employees are a dedicated relational module, so — like Expense — this table
// talks to employeeService (/api/tenant/employees*) directly, with the same
// search / sort / keyset-pagination UX.
export function EmployeeTable() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('employee', 'update');

  const { search: debounced, sortBy, sortDir, setSearch: setDebounced, setSort } = useListUrlState<SortField>({
    sortFields: SORT_FIELDS,
    defaultSort: { field: 'name', dir: 'asc' },
  });
  const [term, setTerm] = useState(debounced);
  const [statusCode, setStatusCode] = useState(ALL_STATUSES);
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

  const req: EmployeeSearchRequest = {
    search: debounced || undefined,
    filters: statusCode ? [{ field: 'status_code', op: 'eq', value: statusCode }] : undefined,
    sort: [{ field: SORT_KEY[sortBy], dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['employees', req],
    queryFn: () => employeeService.searchEmployees(req),
    placeholderData: (prev) => prev,
  });

  const records = data?.records ?? [];
  const hasMore = data?.hasMore ?? false;
  const hasPrev = prevCursors.length > 0;
  const hasFilters = Boolean(term) || Boolean(statusCode);

  function resetPaging() {
    setCursor('');
    setPrevCursors([]);
  }

  // Cursors are opaque — only ever pass back what the server returned.
  function goNext() {
    if (!data?.nextCursor) return;
    setPrevCursors((p) => [...p, cursor]);
    setCursor(data.nextCursor);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function goPrev() {
    const prev = prevCursors[prevCursors.length - 1] ?? '';
    setPrevCursors((p) => p.slice(0, -1));
    setCursor(prev);
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function clearFilters() {
    setTerm('');
    setStatusCode(ALL_STATUSES);
    resetPaging();
  }

  function handleSort(field: SortField) {
    setSort(field, sortBy === field ? (sortDir === 'asc' ? 'desc' : 'asc') : 'asc');
    resetPaging();
  }

  async function handleDownloadCsv() {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportPagedCsv(
        (exportCursor) => employeeService.searchEmployees({ ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor }),
        ['Employee #', 'Name', 'Email', 'Phone', 'Job Title', 'Department', 'Status', 'Created'],
        (e) => [
          e.employeeNumber ?? '', e.displayName ?? '', e.email ?? '', e.phone ?? '',
          e.jobTitle ?? '', e.department ?? '', e.status ?? '', fmtCsvDate(e.createdAt),
        ],
        'Employees',
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
            placeholder="Search name, email, department…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="Search employees"
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150"
          />
        </div>

        <Select
          value={statusCode}
          onChange={(e) => { setStatusCode(e.target.value); resetPaging(); }}
          aria-label="Filter by status"
          className="h-8 w-44 rounded-lg border border-stone-200 bg-white px-2 text-xs text-stone-700"
        >
          <option value={ALL_STATUSES}>All statuses</option>
          {EMPLOYEE_STATUS_CODES.map((s) => (
            <option key={s.code} value={s.code}>{s.label}</option>
          ))}
        </Select>

        <div className="h-5 w-px bg-stone-200" aria-hidden="true" />

        <div className="flex items-center gap-1.5">
          <span className="text-2xs font-semibold uppercase tracking-wider text-stone-500 pr-0.5">Sort:</span>
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
              <SortIcon active={sortBy === field} dir={sortDir} />
            </button>
          ))}
        </div>

        {hasFilters && (
          <button
            onClick={clearFilters}
            aria-label="Clear search and filters"
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
            aria-label={hasFilters ? 'Download filtered employees as CSV' : 'Download all employees as CSV'}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : hasFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        )}
      </div>

      {isError && (
        <p className="text-xs text-red-500">{apiErrorMessage(error, 'Failed to load employees. Please try again.')}</p>
      )}
      {exportError && <p className="text-xs text-red-500">Failed to export CSV: {exportError}</p>}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full sm:min-w-[860px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 max-sm:px-2 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Employee #</th>
                <th className="px-4 max-sm:px-2 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Name</th>
                <th className="px-4 max-sm:px-2 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 max-sm:hidden">Email</th>
                <th className="px-4 max-sm:px-2 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                <th className="px-4 max-sm:px-2 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 max-sm:hidden">Department</th>
                {canEdit && (
                  <th className="px-4 max-sm:px-2 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right max-sm:hidden">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: COLUMN_COUNT }, (_, j) => (
                      <td key={j} className={cn('px-4 max-sm:px-2 py-3', !PHONE_COLUMNS.has(j) && 'max-sm:hidden')}><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    ))}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((emp) => {
                  const approvalLabel = APPROVAL_LABELS[emp.approvalStatus];
                  return (
                    <tr key={emp.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 max-sm:px-2 py-3.5">
                        <Link
                          to={`${LIST_PATH}/${emp.id}`}
                          aria-label={`Open employee ${emp.displayName}`}
                          className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold text-stone-900 hover:text-accent-foreground transition-colors"
                        >
                          {emp.employeeNumber || '—'}
                        </Link>
                      </td>
                      <td className="px-4 max-sm:px-2 py-3.5 text-xs text-stone-800 font-medium truncate max-w-[180px]">
                        {emp.displayName}
                      </td>
                      <td className="px-4 max-sm:px-2 py-3.5 text-xs text-stone-500 truncate max-w-[200px] max-sm:hidden">
                        {emp.email}
                      </td>
                      <td className="px-4 max-sm:px-2 py-3.5">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <ReadOnlyStatusPill label={emp.status} color={EMPLOYEE_STATUS_COLORS[emp.statusCode]} />
                          {approvalLabel && emp.statusCode === 'PEND' && (
                            <span
                              className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-semibold whitespace-nowrap"
                              style={{ backgroundColor: `${APPROVAL_COLORS[emp.approvalStatus]}18`, color: APPROVAL_COLORS[emp.approvalStatus] }}
                            >
                              <ShieldCheck className="size-2.5" aria-hidden="true" />
                              {approvalLabel}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 max-sm:px-2 py-3.5 text-xs text-stone-500 truncate max-w-[140px] max-sm:hidden">
                        {emp.department || '—'}
                      </td>
                      {canEdit && (
                        <td className="px-4 max-sm:px-2 py-3.5 text-right max-sm:hidden">
                          <button
                            type="button"
                            onClick={() => navigate(`${LIST_PATH}/${emp.id}/edit`)}
                            aria-label={`Edit employee ${emp.displayName}`}
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
                  <td colSpan={COLUMN_COUNT} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-2xl bg-stone-100 p-4">
                        {hasFilters ? <Search className="size-6 text-stone-400" /> : <Inbox className="size-6 text-stone-400" />}
                      </div>
                      <p className="text-sm font-semibold text-stone-700">
                        {hasFilters ? 'No employees match the current search.' : 'No employees yet.'}
                      </p>
                      <p className="text-xs text-stone-500">
                        {hasFilters ? 'Try adjusting your search or filters.' : 'Add your first employee to get started.'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {records.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/40">
            <p className="text-xs text-stone-500 tabular-nums">
              Page {prevCursors.length + 1}{hasMore ? '' : ' · last page'}
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
    </div>
  );
}
