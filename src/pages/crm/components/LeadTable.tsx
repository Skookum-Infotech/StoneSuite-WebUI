import { useState, useMemo } from 'react';
import { Search, ArrowUp, ArrowDown, ArrowUpDown, ChevronLeft, ChevronRight, X } from 'lucide-react';
import type { Lead } from '@/types/lead';

type SortField = 'leadId' | 'name' | 'createdAt' | 'updatedAt';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 10;

const LEAD_STATUSES = [
  'LEAD-Unqualified',
  'LEAD-Qualified',
  'LEAD-New',
  'LEAD-In Progress',
  'LEAD-Converted',
  'LEAD-Dead',
] as const;

const statusStyles: Record<string, string> = {
  'LEAD-Unqualified': 'bg-stone-100 text-stone-600',
  'LEAD-Qualified':   'bg-blue-100 text-blue-700',
  'LEAD-New':         'bg-purple-100 text-purple-700',
  'LEAD-In Progress': 'bg-amber-100 text-amber-700',
  'LEAD-Converted':   'bg-green-100 text-green-700',
  'LEAD-Dead':        'bg-red-100 text-red-600',
};

function displayName(lead: Lead): string {
  if (lead.type === 'Individual') {
    return [lead.firstName, lead.lastName].filter(Boolean).join(' ') || lead.companyName || '';
  }
  return lead.companyName || '';
}

const SORT_LABELS: Record<SortField, string> = {
  leadId:    'Document ID',
  name:      'Document Name',
  createdAt: 'Date Created',
  updatedAt: 'Date Modified',
};

type Props = { leads: Lead[]; isLoading?: boolean };

export function LeadTable({ leads, isLoading }: Props) {
  const [idFilter, setIdFilter]         = useState('');
  const [nameFilter, setNameFilter]     = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy]             = useState<SortField>('leadId');
  const [sortDir, setSortDir]           = useState<SortDir>('asc');
  const [page, setPage]                 = useState(1);

  const hasFilters = idFilter || nameFilter || statusFilter;

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
    return leads.filter((lead) => {
      if (idFilter && !lead.leadId?.toLowerCase().includes(idFilter.toLowerCase())) return false;
      if (nameFilter && !displayName(lead).toLowerCase().includes(nameFilter.toLowerCase())) return false;
      if (statusFilter && lead.leadStatus !== statusFilter) return false;
      return true;
    });
  }, [leads, idFilter, nameFilter, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = '';
      let bv = '';
      if (sortBy === 'leadId')    { av = a.leadId ?? '';    bv = b.leadId ?? ''; }
      if (sortBy === 'name')      { av = displayName(a);    bv = displayName(b); }
      if (sortBy === 'createdAt') { av = a.createdAt ?? ''; bv = b.createdAt ?? ''; }
      if (sortBy === 'updatedAt') { av = a.updatedAt ?? ''; bv = b.updatedAt ?? ''; }
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

        {/* Status */}
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-8 rounded-md border border-stone-200 bg-white px-2.5 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
        >
          <option value="">All Statuses</option>
          {LEAD_STATUSES.map((s) => (
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
                <th className="px-3 py-2.5 font-semibold">Lead ID</th>
                <th className="px-3 py-2.5 font-semibold">Name / Company</th>
                <th className="px-3 py-2.5 font-semibold">Type</th>
                <th className="px-3 py-2.5 font-semibold">Email</th>
                <th className="px-3 py-2.5 font-semibold">Phone</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {pageData.map((lead) => (
                <tr key={lead.id} className="hover:bg-stone-50/70 transition-colors">
                  <td className="px-3 py-2 font-mono text-stone-500">{lead.id || '—'}</td>
                  <td className="px-3 py-2">
                    <div className="font-semibold text-stone-900">{displayName(lead) || '—'}</div>
                    {lead.type === 'Individual' && lead.companyName && (
                      <div className="text-2xs text-stone-400">{lead.companyName}</div>
                    )}
                  </td>
                  <td className="px-3 py-2 text-stone-600">{lead.type}</td>
                  <td className="px-3 py-2 text-stone-600">{lead.email || '—'}</td>
                  <td className="px-3 py-2 text-stone-600">{lead.phone || '—'}</td>
                  <td className="px-3 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-2xs font-semibold ${statusStyles[lead.leadStatus] ?? 'bg-stone-100 text-stone-600'}`}>
                      {lead.leadStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isLoading && (
          <div className="flex h-32 items-center justify-center text-xs text-stone-400">
            Loading leads…
          </div>
        )}
        {!isLoading && leads.length === 0 && (
          <div className="flex h-32 items-center justify-center text-xs text-stone-400">
            No leads added yet.
          </div>
        )}
        {!isLoading && leads.length > 0 && pageData.length === 0 && (
          <div className="flex h-32 items-center justify-center text-xs text-stone-400">
            No leads match the current filters.
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-2xs text-stone-400">
            {sorted.length === 0
              ? 'No results'
              : `Showing ${(safePageIndex - 1) * PAGE_SIZE + 1}–${Math.min(safePageIndex * PAGE_SIZE, sorted.length)} of ${sorted.length}`}
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
