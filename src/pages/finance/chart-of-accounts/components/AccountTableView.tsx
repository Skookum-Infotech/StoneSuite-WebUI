import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, X, Landmark, Pencil, Filter,
  ChevronLeft, ChevronRight, Download, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { chartOfAccountsService } from '@/services/chartOfAccountsService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { exportPagedCsv } from '@/lib/csvExport';
import {
  EMPTY_ACCOUNT_TABLE_FILTER_STATE, hasActiveAccountFilters, toAccountFilterClauses,
  type AccountTableFilterState,
} from '@/lib/coaFilters';
import { ACCOUNT_TYPE_LABELS, type Account, type AccountSearchRequest } from '@/types/chartOfAccounts';
import { Switch } from '@/components/ui/switch';
import { AccountFilterDrawer } from './AccountFilterDrawer';
import { BulkActionBar } from './BulkActionBar';
import { AccountFormDrawer } from './AccountFormDrawer';

const EXPORT_PAGE_SIZE = 200;
const PAGE_SIZE = 25;

// Flat, filterable table — the "power users" view, backed by the same
// /accounts/search the tree view's search box uses. Sortable fields are
// limited to code/created_at/updated_at (resolver.go); "code" is this
// module's record_number equivalent.
type SortField = 'code' | 'createdAt' | 'updatedAt';
type SortDir = 'asc' | 'desc';

const SORT_LABELS: Record<SortField, string> = {
  code: 'Code',
  createdAt: 'Created',
  updatedAt: 'Updated',
};

const SORT_KEY: Record<SortField, string> = {
  code: 'code',
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' });
}

export function AccountTableView() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canUpdate = permissionsLoading || hasPermission('chart_of_account', 'update');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('code');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const [filters, setFilters] = useState<AccountTableFilterState>(EMPTY_ACCOUNT_TABLE_FILTER_STATE);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeHidden, setIncludeHidden] = useState(false);

  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);

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

  const req: AccountSearchRequest = {
    search: debounced || undefined,
    filters: toAccountFilterClauses(filters),
    sort: [{ field: SORT_KEY[sortBy], dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };
  const queryFilters = {
    active: includeInactive ? undefined : true,
    visible: includeHidden ? undefined : true,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['coa-accounts', req, queryFilters],
    queryFn: () => chartOfAccountsService.searchAccounts(req, queryFilters),
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

  const filtersActive = hasActiveAccountFilters(filters);
  const hasFilters = Boolean(term) || filtersActive || includeInactive || includeHidden;

  function resetPaging() {
    setCursor('');
    setPrevCursors([]);
  }

  function clearFilters() {
    setTerm('');
    setFilters(EMPTY_ACCOUNT_TABLE_FILTER_STATE);
    setIncludeInactive(false);
    setIncludeHidden(false);
    resetPaging();
  }

  function applyFilters(next: AccountTableFilterState) {
    setFilters(next);
    resetPaging();
  }

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
    resetPaging();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
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
        (exportCursor) => chartOfAccountsService.searchAccounts(
          { ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor },
          queryFilters,
        ),
        ['Code', 'Name', 'Type', 'Category', 'Sub-category', 'BS/PNL', 'Postable', 'Active', 'Visible'],
        (a) => [
          a.code, a.name, ACCOUNT_TYPE_LABELS[a.type],
          a.categoryName, a.subCategoryName, a.bsPnl,
          a.isPostable ? 'Yes' : 'No', a.isActive ? 'Yes' : 'No', a.isVisible ? 'Yes' : 'No',
        ],
        'Chart of Accounts',
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
            placeholder="Search code or name…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150"
            aria-label="Search accounts by code or name"
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

        <label className="flex items-center gap-1.5 text-xs text-stone-600">
          <Switch checked={includeInactive} onCheckedChange={(v) => { setIncludeInactive(v); resetPaging(); }} aria-label="Include inactive accounts" />
          Inactive
        </label>
        <label className="flex items-center gap-1.5 text-xs text-stone-600">
          <Switch checked={includeHidden} onCheckedChange={(v) => { setIncludeHidden(v); resetPaging(); }} aria-label="Include hidden accounts" />
          Hidden
        </label>

        <div className="h-5 w-px bg-stone-200" aria-hidden="true" />

        <div className="flex items-center gap-1.5">
          <span className="text-2xs font-semibold uppercase tracking-wider text-stone-400 pr-0.5">Sort:</span>
          {(Object.entries(SORT_LABELS) as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              aria-pressed={sortBy === field}
              aria-label={`Sort by ${label}${sortBy === field ? `, currently ${sortDir === 'asc' ? 'ascending' : 'descending'}` : ''}`}
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
            aria-label={hasFilters ? 'Download filtered accounts as CSV' : 'Download all accounts as CSV'}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : hasFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        )}
      </div>

      <BulkActionBar selectedIds={[...selectedIds]} onClear={() => setSelectedIds(new Set())} />

      {isError && (
        <p className="text-xs text-red-500">{apiErrorMessage(error, 'Failed to load accounts. Please try again.')}</p>
      )}
      {exportError && (
        <p className="text-xs text-red-500">Failed to export CSV: {exportError}</p>
      )}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[920px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                {canUpdate && <th className="px-4 py-3 w-8" />}
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Code</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Name</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Type</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Sub-category</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">BS/PNL</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Updated</th>
                {canUpdate && (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100" aria-busy={isLoading || undefined}>
              {isLoading ? (
                <>
                  <tr>
                    <td colSpan={7 + (canUpdate ? 2 : 0)} className="sr-only" role="status">
                      Loading accounts…
                    </td>
                  </tr>
                  {Array.from({ length: 5 }, (_, i) => (
                    <tr key={i} aria-hidden="true">
                      {Array.from({ length: canUpdate ? 9 : 7 }, (_, j) => (
                        <td key={j} className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                      ))}
                    </tr>
                  ))}
                </>
              ) : records.length > 0 ? (
                records.map((a) => (
                  <tr
                    key={a.id}
                    onClick={() => navigate(`/finance/chart-of-accounts/${a.id}`)}
                    className="group cursor-pointer hover:bg-accent/10 transition-colors duration-150"
                  >
                    {canUpdate && (
                      <td className="px-4 py-3.5" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(a.id)}
                          onChange={() => toggleSelect(a.id)}
                          aria-label={`Select ${a.code} ${a.name}`}
                          className="size-3.5 rounded border-stone-300"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/finance/chart-of-accounts/${a.id}`); }}
                        className="font-mono text-xs font-semibold text-stone-900 hover:text-accent-foreground transition-colors"
                      >
                        {a.code}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-stone-700 truncate max-w-[220px]">
                      <span className={cn(!a.isActive && 'italic text-stone-400')}>{a.name}</span>
                      {a.isSystem && <span className="ml-1.5 text-2xs font-semibold text-stone-400">SYS</span>}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-stone-500 whitespace-nowrap">{ACCOUNT_TYPE_LABELS[a.type]}</td>
                    <td className="px-4 py-3.5 text-xs text-stone-500 truncate max-w-[180px]">
                      {a.subCategoryCode} — {a.subCategoryName}
                    </td>
                    <td className="px-4 py-3.5 text-xs text-stone-500">{a.bsPnl}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-1.5">
                        {!a.isActive && <span className="text-2xs font-semibold text-stone-400">Inactive</span>}
                        {!a.isVisible && <span className="text-2xs font-semibold text-stone-400">Hidden</span>}
                        {a.isActive && a.isVisible && <span className="text-2xs font-semibold text-emerald-600">Active</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-stone-400 tabular-nums whitespace-nowrap">
                      {fmtDate(a.updatedAt)}
                    </td>
                    {canUpdate && (
                      <td className="px-4 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setEditingAccount(a)}
                          aria-label={`Edit ${a.code} ${a.name}`}
                          className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-500 transition-colors hover:bg-accent hover:border-accent hover:text-accent-foreground cursor-pointer"
                        >
                          <Pencil className="size-4" />
                        </button>
                      </td>
                    )}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7 + (canUpdate ? 2 : 0)} className="py-16 text-center">
                    {!hasFilters ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Landmark className="size-6 text-stone-400" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700">No accounts found.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-stone-400" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700">No accounts match the current search.</p>
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
        <AccountFilterDrawer onClose={() => setFiltersOpen(false)} value={filters} onApply={applyFilters} />
      )}

      {editingAccount && (
        <AccountFormDrawer
          account={editingAccount}
          onClose={() => setEditingAccount(null)}
          onSaved={() => setEditingAccount(null)}
        />
      )}
    </div>
  );
}
