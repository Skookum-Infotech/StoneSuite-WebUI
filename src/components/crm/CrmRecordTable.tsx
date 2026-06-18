import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown,
  ChevronLeft, ChevronRight, X, Inbox,
} from 'lucide-react';
import { crmService } from '@/services/crmService';
import { Badge } from '@/components/tenant/ui';
import { resolveStatusColor } from '@/components/crm/formUtils';
import type { WorkflowRecord, StatusInfo } from '@/types/tenant';

// ── Avatar helpers ─────────────────────────────────────────────────────────────

const AVATAR_PALETTE = [
  { bg: '#fef3c7', fg: '#92400e' },
  { bg: '#d1fae5', fg: '#065f46' },
  { bg: '#dbeafe', fg: '#1e40af' },
  { bg: '#fce7f3', fg: '#9d174d' },
  { bg: '#ede9fe', fg: '#5b21b6' },
  { bg: '#ecfccb', fg: '#365314' },
  { bg: '#ffedd5', fg: '#9a3412' },
  { bg: '#e0f2fe', fg: '#0c4a6e' },
  { bg: '#f1f5f9', fg: '#334155' },
] as const;

function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function companyAvatar(name: string) {
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

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
      const company = String(r.coreFields.customer_name ?? '').toLowerCase();
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
      if (sortBy === 'name')      { av = String(a.coreFields.customer_name ?? ''); bv = String(b.coreFields.customer_name ?? ''); }
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
          <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
          <input
            type="text"
            placeholder={`Search ${config.label.toLowerCase()}s…`}
            value={nameFilter}
            onChange={(e) => { setNameFilter(e.target.value); setPage(1); }}
            className="h-9 w-52 rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-sm text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="h-9 rounded-lg border border-stone-200 bg-white px-3 text-sm text-stone-700 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150"
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
              className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-500 hover:bg-stone-50 transition-colors"
            >
              <X className="size-3" />
              Clear
            </button>
          )}
          <span className="text-xs text-stone-400 tabular-nums">
            {filtered.length} result{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* ── Sort chips ── */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-2xs font-semibold uppercase tracking-wider text-stone-400">Sort:</span>
        {(Object.entries(SORT_LABELS) as [SortField, string][]).map(([field, label]) => (
          <button
            key={field}
            onClick={() => handleSort(field)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-2xs font-semibold transition-colors ${
              sortBy === field
                ? 'bg-accent text-accent-foreground ring-1 ring-accent-foreground/20'
                : 'bg-white border border-stone-200 text-stone-500 hover:border-stone-300 hover:text-stone-700'
            }`}
          >
            {label}
            <SortIcon field={field} />
          </button>
        ))}
      </div>

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-stone-200" style={{ backgroundColor: 'color-mix(in srgb, #ecfccb 22%, #ffffff)' }}>
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Company</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                {config.showEmail && (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Email</th>
                )}
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Created</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                <>
                  {Array.from({ length: 5 }, (_, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="animate-pulse size-8 rounded-full bg-stone-100 shrink-0" />
                          <div className="animate-pulse h-3.5 rounded bg-stone-100 w-36" />
                        </div>
                      </td>
                      <td className="px-4 py-3"><div className="animate-pulse h-3.5 rounded bg-stone-100 w-24" /></td>
                      {config.showEmail && <td className="px-4 py-3"><div className="animate-pulse h-3.5 rounded bg-stone-100 w-32" /></td>}
                      <td className="px-4 py-3"><div className="animate-pulse h-3.5 rounded bg-stone-100 w-20" /></td>
                      <td className="px-4 py-3" />
                    </tr>
                  ))}
                </>
              ) : pageData.length > 0 ? (
                <>
                  {pageData.map((record) => {
                    const statusInfo = statusMap.get(record.currentStateId);
                    const company    = String(record.coreFields.customer_name ?? '(unnamed)');
                    const email      = String(record.coreFields.customer_contact_email ?? '—');
                    const label      = `${config.label} — ${company}`;
                    const avatar     = companyAvatar(company);
                    return (
                      <tr key={record.id} className="group hover:bg-accent/10 transition-colors duration-150">
                        <td className="px-4 py-3.5">
                          <div className="flex items-center gap-3">
                            <span
                              className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                              style={{ backgroundColor: avatar.bg, color: avatar.fg }}
                              aria-hidden="true"
                            >
                              {companyInitials(company)}
                            </span>
                            <div>
                              <button
                                type="button"
                                onClick={() => navigate(config.detailPath(record.id))}
                                className="text-left text-sm font-semibold text-stone-900 hover:text-accent-foreground transition-colors duration-150"
                              >
                                {company}
                              </button>
                              {record.recordNumber && (
                                <p className="font-mono text-2xs text-stone-400 mt-0.5">{record.recordNumber}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3.5">
                          {statusInfo ? (
                            <Badge color={resolveStatusColor(statusInfo.stateKey, statusInfo.color)}>{statusInfo.statusLabel}</Badge>
                          ) : (
                            <span className="text-xs text-stone-400">—</span>
                          )}
                        </td>
                        {config.showEmail && (
                          <td className="px-4 py-3.5 text-sm text-stone-500">{email}</td>
                        )}
                        <td className="px-4 py-3.5 text-xs text-stone-400 tabular-nums">
                          {new Date(record.createdAt).toLocaleDateString(undefined, {
                            year: 'numeric', month: 'short', day: 'numeric',
                          })}
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(config.editPath(record.id))}
                            aria-label={`Edit ${label}`}
                            className="rounded-md border border-stone-200 bg-white px-2.5 py-1 text-xs font-semibold text-stone-600 transition-colors hover:border-accent-foreground/30 hover:bg-accent hover:text-accent-foreground"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </>
              ) : (
                <tr>
                  <td
                    colSpan={4 + (config.showEmail ? 1 : 0)}
                    className="py-16 text-center"
                  >
                    {records.length === 0 ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Inbox className="size-6 text-stone-400" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700">No {lowerLabel}s added yet.</p>
                        <p className="text-xs text-stone-400">Create your first {lowerLabel} to get started.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-stone-400" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700">No {lowerLabel}s match the current filters.</p>
                        <p className="text-xs text-stone-400">Try adjusting your search or status filter.</p>
                      </div>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      {sorted.length > 0 && (
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-stone-400 tabular-nums">
            {`Showing ${(safePage - 1) * PAGE_SIZE + 1}–${Math.min(safePage * PAGE_SIZE, sorted.length)} of ${sorted.length}`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              aria-label="Previous page"
              className="flex items-center gap-1 rounded-sm border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="size-3" /> Prev
            </button>
            <span className="min-w-[72px] text-center text-xs text-stone-500 tabular-nums">
              Page {safePage} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              aria-label="Next page"
              className="flex items-center gap-1 rounded-sm border border-stone-200 px-2.5 py-1.5 text-xs font-semibold text-stone-600 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40 transition-colors"
            >
              Next <ChevronRight className="size-3" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
