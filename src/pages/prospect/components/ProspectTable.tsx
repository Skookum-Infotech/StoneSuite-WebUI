import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Prospect } from '@/types/prospect';

type SortField = 'id' | 'name' | 'createdAt' | 'updatedAt';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 10;

const SORT_LABELS: Record<SortField, string> = {
  id:        'Document ID',
  name:      'Document Name',
  createdAt: 'Date Created',
  updatedAt: 'Date Modified',
};

const statusStyles: Record<string, string> = {
  active:      'bg-green-100 text-green-700',
  inactive:    'bg-stone-100 text-stone-500',
  pending:     'bg-amber-100 text-amber-700',
  suspended:   'bg-red-100 text-red-600',
  prospect:    'bg-blue-100 text-blue-700',
  customer:    'bg-emerald-100 text-emerald-700',
};

function shortId(id: string): string {
  return id.length > 8 ? `…${id.slice(-8)}` : id;
}

function statusBadgeClass(status: string): string {
  return statusStyles[status?.toLowerCase()] ?? 'bg-stone-100 text-stone-600';
}

type Props = {
  prospects: Prospect[];
  isLoading?: boolean;
};

export function ProspectTable({ prospects, isLoading }: Props) {
  const navigate = useNavigate();

  const [idFilter, setIdFilter]         = useState('');
  const [nameFilter, setNameFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy]             = useState<SortField>('createdAt');
  const [sortDir, setSortDir]           = useState<SortDir>('desc');
  const [page, setPage]                 = useState(1);

  const hasFilters = idFilter || nameFilter || statusFilter;

  // Derive unique statuses from the data for the filter dropdown
  const uniqueStatuses = useMemo(
    () => [...new Set(prospects.map((p) => p.status).filter(Boolean))].sort(),
    [prospects],
  );

  function clearFilters() {
    setIdFilter('');
    setNameFilter('');
    setStatusFilter('');
    setPage(1);
  }

  function handleSort(field: SortField) {
    if (sortBy === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
    setPage(1);
  }

  const filtered = useMemo(() => {
    return prospects.filter((p) => {
      const docId = p.customer_id || p.id;
      if (idFilter && !docId.toLowerCase().includes(idFilter.toLowerCase())) return false;
      if (nameFilter && !p.company_name?.toLowerCase().includes(nameFilter.toLowerCase())) return false;
      if (statusFilter && p.status !== statusFilter) return false;
      return true;
    });
  }, [prospects, idFilter, nameFilter, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = '';
      let bv = '';
      if (sortBy === 'id')        { av = a.customer_id || a.id; bv = b.customer_id || b.id; }
      if (sortBy === 'name')      { av = a.company_name ?? '';  bv = b.company_name ?? ''; }
      if (sortBy === 'createdAt') { av = a.created_at ?? '';    bv = b.created_at ?? ''; }
      if (sortBy === 'updatedAt') { av = a.updated_at ?? '';    bv = b.updated_at ?? ''; }
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePageIndex = Math.min(page, totalPages);
  const pageData = sorted.slice((safePageIndex - 1) * PAGE_SIZE, safePageIndex * PAGE_SIZE);

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <ArrowUpDown className="size-2.5 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="size-2.5" />
      : <ArrowDown className="size-2.5" />;
  }

  return (
    <div className="flex flex-col gap-3">

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Document ID */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-stone-400" />
          <input
            type="text"
            placeholder="Document ID…"
            value={idFilter}
            onChange={(e) => { setIdFilter(e.target.value); setPage(1); }}
            className="h-8 w-36 rounded-md border border-stone-200 bg-white pl-7 pr-2.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
          />
        </div>

        {/* Document Name */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-stone-400" />
          <input
            type="text"
            placeholder="Document Name…"
            value={nameFilter}
            onChange={(e) => { setNameFilter(e.target.value); setPage(1); }}
            className="h-8 w-44 rounded-md border border-stone-200 bg-white pl-7 pr-2.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
          />
        </div>

        {/* Status — derived from actual data */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-8 rounded-md border border-stone-200 bg-white px-2.5 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
        >
          <option value="">All Statuses</option>
          {uniqueStatuses.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        {/* Right: clear + count */}
        <div className="ml-auto flex items-center gap-2">
          {hasFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-2xs text-stone-500 hover:bg-stone-50 transition-colors"
            >
              <X className="size-2.5" />
              Clear filters
            </button>
          )}
          <span className="text-2xs text-stone-400">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Sort chips ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-2xs uppercase tracking-wider text-stone-400 mr-1">Sort:</span>
        {(Object.entries(SORT_LABELS) as [SortField, string][]).map(([field, label]) => (
          <button
            key={field}
            onClick={() => handleSort(field)}
            className={`flex items-center gap-1 rounded-md px-2 py-1 text-2xs font-semibold transition-colors ${
              sortBy === field
                ? 'bg-brand/20 text-brand-dark ring-1 ring-brand/30'
                : 'bg-stone-100 text-stone-500 hover:bg-stone-200'
            }`}
          >
            {label}
            <SortIcon field={field} />
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-md border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-brand/20 text-2xs uppercase tracking-wide text-brand-dark">
              <tr>
                <th className="px-3 py-2.5 font-semibold">Prospect ID</th>
                <th className="px-3 py-2.5 font-semibold">Company Name</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                <th className="px-3 py-2.5 font-semibold">Email</th>
                <th className="px-3 py-2.5 font-semibold">Customer Type</th>
                <th className="px-3 py-2.5 font-semibold">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {pageData.map((prospect) => (
                <tr
                  key={prospect.id}
                  onClick={() => navigate(`/prospects/${prospect.id}`)}
                  className="cursor-pointer hover:bg-stone-50/70 transition-colors"
                  aria-label={`View prospect ${prospect.company_name || prospect.id}`}
                >
                  <td className="px-3 py-2 font-mono text-stone-500">
                    {prospect.customer_id ? prospect.customer_id : shortId(prospect.id)}
                  </td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-stone-900">
                      {prospect.company_name || '(unnamed)'}
                    </div>
                    {prospect.billing_account_name && prospect.billing_account_name !== prospect.company_name && (
                      <div className="text-2xs text-stone-400">{prospect.billing_account_name}</div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    {prospect.status ? (
                      <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${statusBadgeClass(prospect.status)}`}>
                        {prospect.status}
                      </span>
                    ) : (
                      <span className="text-stone-400">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-stone-600">{prospect.email || '—'}</td>
                  <td className="px-3 py-2 text-stone-600">{prospect.customer_type || '—'}</td>
                  <td className="px-3 py-2 text-stone-400">
                    {prospect.created_at
                      ? new Date(prospect.created_at).toLocaleDateString(undefined, {
                          year: 'numeric', month: 'short', day: 'numeric',
                        })
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isLoading && (
          <div className="flex h-32 items-center justify-center text-xs text-stone-400">
            Loading prospects…
          </div>
        )}
        {!isLoading && prospects.length === 0 && (
          <div className="flex h-32 items-center justify-center text-xs text-stone-400">
            No prospects added yet.
          </div>
        )}
        {!isLoading && prospects.length > 0 && pageData.length === 0 && (
          <div className="flex h-32 items-center justify-center text-xs text-stone-400">
            No prospects match the current filters.
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-2xs text-stone-400">
            {`Showing ${(safePageIndex - 1) * PAGE_SIZE + 1}–${Math.min(safePageIndex * PAGE_SIZE, sorted.length)} of ${sorted.length}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePageIndex === 1}
              aria-label="Previous page"
              className="flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-2xs font-semibold text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="size-3" />
              Prev
            </button>
            <span className="min-w-[72px] text-center text-2xs text-stone-500">
              Page {safePageIndex} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePageIndex === totalPages}
              aria-label="Next page"
              className="flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-2xs font-semibold text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              Next
              <ChevronRight className="size-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
