import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, X, Inbox, Pencil,
  ChevronLeft, ChevronRight, ShieldAlert,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { crmService } from '@/services/crmService';
import { resolveStatusColor } from '@/components/crm/formUtils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { recordApprovalState, type StatusInfo, type FilterRequest, type FilterClause } from '@/types/tenant';

// ── Avatar helpers ─────────────────────────────────────────────────────────────

const AVATAR_PALETTE: { bg: string; fg: string }[] = [
  { bg: '#6366f1', fg: '#ffffff' },
  { bg: '#10b981', fg: '#ffffff' },
  { bg: '#3b82f6', fg: '#ffffff' },
  { bg: '#f43f5e', fg: '#ffffff' },
  { bg: '#a855f7', fg: '#ffffff' },
  { bg: '#f59e0b', fg: '#ffffff' },
  { bg: '#14b8a6', fg: '#ffffff' },
  { bg: '#f97316', fg: '#ffffff' },
  { bg: '#ec4899', fg: '#ffffff' },
];

function companyAvatarVars(name: string): { bg: string; fg: string } {
  const hash = [...name].reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length];
}

function companyInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) return (words[0][0] + words[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

// ── Public config type ─────────────────────────────────────────────────────────

export type CrmTableConfig = {
  workflowKey: string;
  label: string;
  detailPath: (id: string) => string;
  editPath:   (id: string) => string;
  queryKey:   readonly [string, string];
  showEmail?: boolean;
};

// ── Internal types ─────────────────────────────────────────────────────────────

type SortField = 'createdAt' | 'updatedAt';
type SortDir   = 'asc' | 'desc';

const PAGE_SIZE = 25;

const SORT_LABELS: Record<SortField, string> = {
  createdAt: 'Date Created',
  updatedAt: 'Date Modified',
};

const SORT_KEY: Record<SortField, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

// ── Component ──────────────────────────────────────────────────────────────────

type Props = { config: CrmTableConfig };

export function CrmRecordTable({ config }: Props) {
  const navigate   = useNavigate();
  const topRef     = useRef<HTMLDivElement>(null);

  // Show the Edit action while permissions are still loading (avoids a flash
  // of a hidden button), then hide it once we know the user lacks update rights.
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission(config.workflowKey, 'update');

  // ── filter / sort state ────────────────────────────────────────────────────
  const [nameFilter,    setNameFilter]    = useState('');
  const [debouncedName, setDebouncedName] = useState('');
  const [statusFilter,  setStatusFilter]  = useState('');
  const [sortBy,        setSortBy]        = useState<SortField>('createdAt');
  const [sortDir,       setSortDir]       = useState<SortDir>('desc');

  // ── cursor-stack pagination ────────────────────────────────────────────────
  // cursor     = the cursor sent with the current request ('' = page 1)
  // prevCursors = stack of cursors needed to go back (LIFO)
  const [cursor,      setCursor]      = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  // Debounce name search; fold cursor reset into the same timeout so it fires
  // when the debounced value settles (async callback, not effect body).
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedName(nameFilter.trim());
      setCursor('');
      setPrevCursors([]);
    }, 300);
    return () => clearTimeout(t);
  }, [nameFilter]);

  // ── statuses ───────────────────────────────────────────────────────────────
  const { data: statusData } = useQuery({
    queryKey:  ['crm-statuses-workflow', config.workflowKey],
    queryFn:   () => crmService.getWorkflowStatuses(config.workflowKey),
    staleTime: 10 * 60 * 1000,
  });

  const statuses = useMemo<StatusInfo[]>(() => statusData?.statuses ?? [], [statusData]);
  const statusMap = useMemo(
    () => new Map<string, StatusInfo>(statuses.map((s) => [s.stateId, s])),
    [statuses],
  );

  // ── build request ──────────────────────────────────────────────────────────
  const filterRequest = useMemo<FilterRequest>(() => {
    const filters: FilterClause[] = [];
    if (debouncedName) filters.push({ field: 'core:customer_name', op: 'contains', value: debouncedName });
    if (statusFilter)  filters.push({ field: 'status', op: 'eq', value: statusFilter });
    return {
      filters,
      sort:   [{ field: SORT_KEY[sortBy], dir: sortDir }],
      limit:  PAGE_SIZE,
      cursor: cursor || undefined,
    };
  }, [debouncedName, statusFilter, sortBy, sortDir, cursor]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['crm-records', config.workflowKey, filterRequest],
    queryFn:  () => crmService.searchRecords(config.workflowKey, filterRequest),
    placeholderData: (prev) => prev,
  });

  const records  = data?.records  ?? [];
  const hasMore  = data?.hasMore  ?? false;
  const hasPrev  = prevCursors.length > 0;
  const pageNum  = prevCursors.length + 1;

  // ── navigation ─────────────────────────────────────────────────────────────
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

  // ── filter helpers ─────────────────────────────────────────────────────────
  const hasFilters = Boolean(nameFilter || statusFilter);

  function clearFilters() {
    setNameFilter('');
    setStatusFilter('');
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

  const lowerLabel = config.label.toLowerCase();

  return (
    <div ref={topRef} className="flex flex-col gap-3 scroll-mt-4">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Search */}
        <div className="relative w-full sm:w-52">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
          <input
            type="text"
            placeholder={`Search ${lowerLabel}s…`}
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150"
          />
        </div>

        {/* Status filter */}
        <div className="relative w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCursor(''); setPrevCursors([]); }}
            className={cn(
              'h-8 w-full rounded-lg border border-stone-200 bg-white pl-3 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150 appearance-none',
              statusFilter === '' ? 'text-stone-400' : 'text-stone-900',
            )}
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            {statuses.map((s) => (
              <option key={s.stateId} value={s.stateId}>{s.statusLabel}</option>
            ))}
          </select>
          <ChevronRight className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3 text-stone-400 rotate-90" />
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-stone-200" aria-hidden="true" />

        {/* Sort chips */}
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

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs text-stone-500 hover:bg-stone-50 transition-colors"
          >
            <X className="size-3" />
            Clear
          </button>
        )}
      </div>

      {isError && (
        <p className="text-xs text-red-500">Failed to load {lowerLabel}s. Please try again.</p>
      )}

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Company</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                {config.showEmail && (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Email</th>
                )}
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Created</th>
                {canEdit && (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="animate-pulse size-8 rounded-full bg-stone-100 shrink-0" />
                        <div className="animate-pulse h-3 rounded bg-stone-100 w-36" />
                      </div>
                    </td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-24" /></td>
                    {config.showEmail && <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-32" /></td>}
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-20" /></td>
                    {canEdit && <td className="px-4 py-3" />}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((record) => {
                  const statusInfo = statusMap.get(record.currentStateId);
                  const company    = String(record.coreFields.customer_name ?? '(unnamed)');
                  const email      = String(record.coreFields.customer_contact_email ?? '—');
                  const label      = `${config.label} — ${company}`;
                  const avatar     = companyAvatarVars(company);
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
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => navigate(config.detailPath(record.id))}
                              className="text-left text-xs font-semibold text-stone-900 hover:text-accent-foreground transition-colors truncate max-w-[200px] block"
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
                        {statusInfo ? (() => {
                          const color = resolveStatusColor(statusInfo.stateKey, statusInfo.color);
                          return (
                            <span
                              className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-stone-600 whitespace-nowrap"
                              style={{ backgroundColor: `${color}18` }}
                            >
                              <span
                                className="size-1.5 shrink-0 rounded-full"
                                style={{ backgroundColor: color }}
                                aria-hidden="true"
                              />
                              {statusInfo.statusLabel}
                            </span>
                          );
                        })() : (
                          <span className="text-xs text-stone-400">—</span>
                        )}
                        {recordApprovalState(record) === 'pending' && (
                          <span
                            className="ml-1.5 inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-2xs font-semibold text-amber-700 whitespace-nowrap"
                            title="Awaiting approver sign-off"
                          >
                            <ShieldAlert className="size-2.5" aria-hidden="true" />
                            Needs Approval
                          </span>
                        )}
                      </td>
                      {config.showEmail && (
                        <td className="px-4 py-3.5 text-xs text-stone-500 truncate max-w-[180px]">{email}</td>
                      )}
                      <td className="px-4 py-3.5 text-xs text-stone-400 tabular-nums whitespace-nowrap">
                        {new Date(record.createdAt).toLocaleDateString(undefined, {
                          year: '2-digit', month: 'short', day: 'numeric',
                        })}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(config.editPath(record.id))}
                            aria-label={`Edit ${label}`}
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
                  <td colSpan={3 + (config.showEmail ? 1 : 0) + (canEdit ? 1 : 0)} className="py-16 text-center">
                    {!hasFilters ? (
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

        {/* ── Pagination footer ── */}
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
    </div>
  );
}
