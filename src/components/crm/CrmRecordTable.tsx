import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown,
  ChevronLeft, ChevronRight, X, Pencil,
} from 'lucide-react';
import { crmService } from '@/services/crmService';
import { DeleteRecordDialog } from '@/components/crm/DeleteRecordDialog';
import { Badge } from '@/components/tenant/ui';
import type { WorkflowRecord, StatusInfo } from '@/types/tenant';

// ── Public config type — import this in each thin wrapper ─────────────────────

export type CrmTableConfig = {
  workflowKey: string;
  label: string;                          // singular: "Lead", "Prospect", "Customer"
  detailPath: (id: string) => string;
  editPath:   (id: string) => string;
  queryKey:   readonly [string, string];  // for cache invalidation after delete
  showEmail?: boolean;                    // show an Email column (default false)
};

// ── Internal types ─────────────────────────────────────────────────────────────

type SortField = 'id' | 'name' | 'createdAt' | 'updatedAt';
type SortDir   = 'asc' | 'desc';

const PAGE_SIZE = 10;

const SORT_LABELS: Record<SortField, string> = {
  id:        'Record ID',
  name:      'Company Name',
  createdAt: 'Date Created',
  updatedAt: 'Date Modified',
};

// ── Component ──────────────────────────────────────────────────────────────────

type Props = {
  records:   WorkflowRecord[];
  isLoading: boolean;
  config:    CrmTableConfig;
};

export function CrmRecordTable({ records, isLoading, config }: Props) {
  const navigate     = useNavigate();
  const queryClient  = useQueryClient();

  const [nameFilter,   setNameFilter]   = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy,       setSortBy]       = useState<SortField>('createdAt');
  const [sortDir,      setSortDir]      = useState<SortDir>('desc');
  const [page,         setPage]         = useState(1);

  const { data: statusData } = useQuery({
    queryKey: ['crm-statuses-workflow', config.workflowKey],
    queryFn:  () => crmService.getWorkflowStatuses(config.workflowKey),
  });

  const statuses = useMemo<StatusInfo[]>(
    () => statusData?.statuses ?? [],
    [statusData],
  );

  const statusMap = useMemo(
    () => new Map<string, StatusInfo>(statuses.map((s) => [s.stateId, s])),
    [statuses],
  );

  const hasFilters = nameFilter || statusFilter;

  function clearFilters() {
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
    return records.filter((r) => {
      const company = String(r.coreFields.company_name ?? '').toLowerCase();
      if (nameFilter   && !company.includes(nameFilter.toLowerCase())) return false;
      if (statusFilter && r.currentStateId !== statusFilter)           return false;
      return true;
    });
  }, [records, nameFilter, statusFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let av = '';
      let bv = '';
      if (sortBy === 'id')        { av = a.id;                                   bv = b.id; }
      if (sortBy === 'name')      { av = String(a.coreFields.company_name ?? ''); bv = String(b.coreFields.company_name ?? ''); }
      if (sortBy === 'createdAt') { av = a.createdAt;                             bv = b.createdAt; }
      if (sortBy === 'updatedAt') { av = a.updatedAt;                             bv = b.updatedAt; }
      const cmp = av.localeCompare(bv, undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortBy, sortDir]);

  const totalPages   = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const safePage     = Math.min(page, totalPages);
  const pageData     = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  function SortIcon({ field }: { field: SortField }) {
    if (sortBy !== field) return <ArrowUpDown className="size-2.5 opacity-40" />;
    return sortDir === 'asc' ? <ArrowUp className="size-2.5" /> : <ArrowDown className="size-2.5" />;
  }

  const lowerLabel = config.label.toLowerCase();

  return (
    <div className="flex flex-col gap-3">

      {/* ── Filter bar ── */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-stone-400" />
          <input
            type="text"
            placeholder="Company name…"
            value={nameFilter}
            onChange={(e) => { setNameFilter(e.target.value); setPage(1); }}
            className="h-8 w-44 rounded-md border border-stone-200 bg-white pl-7 pr-2.5 text-xs text-stone-800 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-8 rounded-md border border-stone-200 bg-white px-2.5 text-xs text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
          aria-label="Filter by status"
        >
          <option value="">All Statuses</option>
          {statuses.map((s) => (
            <option key={s.stateId} value={s.stateId}>{s.statusLabel}</option>
          ))}
        </select>

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
        <span className="mr-1 text-2xs uppercase tracking-wider text-stone-400">Sort:</span>
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
                <th className="px-3 py-2.5 font-semibold">Company</th>
                <th className="px-3 py-2.5 font-semibold">Status</th>
                {config.showEmail && (
                  <th className="px-3 py-2.5 font-semibold">Email</th>
                )}
                <th className="px-3 py-2.5 font-semibold">Created</th>
                <th className="px-3 py-2.5 font-semibold sr-only">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {pageData.map((record) => {
                const statusInfo = statusMap.get(record.currentStateId);
                const company    = String(record.coreFields.company_name ?? '(unnamed)');
                const email      = String(record.coreFields.email ?? record.ownerUserId ?? '—');
                const label      = `${config.label} — ${company}`;
                return (
                  <tr key={record.id} className="hover:bg-stone-50/70 transition-colors">
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        onClick={() => navigate(config.detailPath(record.id))}
                        className="text-left font-semibold text-stone-900 hover:text-brand-dark hover:underline"
                      >
                        {company}
                      </button>
                    </td>
                    <td className="px-3 py-2">
                      {statusInfo ? (
                        <Badge color={statusInfo.color}>{statusInfo.statusLabel}</Badge>
                      ) : (
                        <span className="text-2xs text-stone-400">—</span>
                      )}
                    </td>
                    {config.showEmail && (
                      <td className="px-3 py-2 text-stone-600">{email}</td>
                    )}
                    <td className="px-3 py-2 text-stone-400">
                      {new Date(record.createdAt).toLocaleDateString(undefined, {
                        year: 'numeric', month: 'short', day: 'numeric',
                      })}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => navigate(config.editPath(record.id))}
                          aria-label={`Edit ${label}`}
                          className="rounded p-1 text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <DeleteRecordDialog
                          recordId={record.id}
                          workflowKey={config.workflowKey}
                          label={label}
                          onDeleted={() =>
                            queryClient.invalidateQueries({ queryKey: [...config.queryKey] })
                          }
                        />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {isLoading && (
          <div className="flex h-32 items-center justify-center text-xs text-stone-400">
            Loading {lowerLabel}s…
          </div>
        )}
        {!isLoading && records.length === 0 && (
          <div className="flex h-32 items-center justify-center text-xs text-stone-400">
            No {lowerLabel}s added yet.
          </div>
        )}
        {!isLoading && records.length > 0 && pageData.length === 0 && (
          <div className="flex h-32 items-center justify-center text-xs text-stone-400">
            No {lowerLabel}s match the current filters.
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-2xs text-stone-400">
            {`Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, sorted.length)} of ${sorted.length}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label="Previous page"
              className="flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-2xs font-semibold text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="size-3" /> Prev
            </button>
            <span className="min-w-[72px] text-center text-2xs text-stone-500">
              Page {safePage} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              aria-label="Next page"
              className="flex items-center gap-1 rounded-md border border-stone-200 px-2 py-1 text-2xs font-semibold text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              Next <ChevronRight className="size-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
