import { Select } from '@/components/ui/select';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Search, X, Inbox, Pencil, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { LIST_DATE_OPTIONS } from '@/lib/dateUtils';
import { crmService, CRM_WORKFLOW_KEYS } from '@/services/crmService';
import { userService } from '@/services/tenantServices';
import { apiErrorMessage } from '@/api/tenantClient';
import { StatusDropdown } from '@/components/crm/StatusDropdown';
import { Badge } from '@/components/tenant/ui';
import { resolveStatusColor } from '@/components/crm/formUtils';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { buildCrmCsvFilename, buildCrmRecordsCsv, downloadCsv } from '@/lib/crmCsvExport';
import { useIdSelection } from '@/hooks/useIdSelection';
import { BulkSelectionBar } from '@/components/tenant/BulkSelectionBar';
import { SelectAllCheckbox, SelectRowCheckbox } from '@/components/tenant/SelectionCheckboxes';
import { CRM_WORKFLOW_ROUTES } from '@/components/crm/crmWorkflowRoutes';
import {
  recordApprovalState,
  type StatusInfo, type FilterRequest, type FilterClause, type WorkflowRecord,
} from '@/types/tenant';
import { SortIcon } from '@/components/ui/SortIcon';
import { useListUrlState } from '@/hooks/useListUrlState';

import { buttonVariants } from '@/components/ui/button';
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
  /** Adds a checkbox column and an "Export selected (CSV)" bar. */
  selectable?: boolean;
};

// ── Internal types ─────────────────────────────────────────────────────────────

type SortField = 'createdAt' | 'updatedAt';

const PAGE_SIZE = 25;
// Larger page size for CSV export — fewer round trips while paging through every
// matching record (vs. the 25-row page size used for on-screen browsing).
const EXPORT_PAGE_SIZE = 200;

const SORT_LABELS: Record<SortField, string> = {
  createdAt: 'Date Created',
  updatedAt: 'Date Modified',
};

const SORT_FIELDS = Object.keys(SORT_LABELS) as SortField[];

const SORT_KEY: Record<SortField, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
};

// ── Component ──────────────────────────────────────────────────────────────────

type Props = { config: CrmTableConfig };

export function CrmRecordTable({ config }: Props) {
  const navigate   = useNavigate();
  const queryClient = useQueryClient();
  const topRef     = useRef<HTMLDivElement>(null);

  // Show the Edit action while permissions are still loading (avoids a flash
  // of a hidden button), then hide it once we know the user lacks update rights.
  const { hasPermission, isSuperAdmin, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission(config.workflowKey, 'update');

  // The list row's status is a dropdown only for a super admin; everyone else
  // sees a plain badge and moves a lead or prospect from its Detail or Edit
  // page. A customer's status is changed with the Quick Action buttons on its
  // detail page, never from a dropdown, so its row is a badge for everyone.
  const canChangeStatusInList = isSuperAdmin && config.workflowKey !== CRM_WORKFLOW_KEYS.CUSTOMER;

  // Inline status change from the list row's status pill (see
  // canChangeStatusInList). Mirrors the Edit page's transition mutation (see
  // EditLeadPage.tsx) — persists the moment a status is picked, no separate
  // save. A converting transition (e.g. Lead -> Prospect) navigates to the new
  // record, same as the Edit page does today.
  const transition = useMutation({
    mutationFn: (vars: { id: string; toStateId: string }) =>
      crmService.transitionRecord(vars.id, vars.toStateId, config.workflowKey),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['crm-record', updated.id] });
      // The dropdown's legal next moves depend on the status just set.
      queryClient.invalidateQueries({ queryKey: ['crm-transitions', updated.id] });
      queryClient.invalidateQueries({ queryKey: ['crm-records', config.workflowKey] });
      const newType = updated.workflowId?.toLowerCase();
      if (newType && newType !== config.workflowKey && CRM_WORKFLOW_ROUTES[newType]) {
        queryClient.invalidateQueries({ queryKey: ['crm-records', newType] });
        navigate(`${CRM_WORKFLOW_ROUTES[newType]}/${updated.id}`);
      }
    },
  });

  // ── filter / sort state ────────────────────────────────────────────────────
  // Search text and sort live in the URL so a reload / Back lands on the same view.
  const { search: debouncedName, sortBy, sortDir, setSearch: setDebouncedName, setSort } = useListUrlState<SortField>({
    sortFields: SORT_FIELDS,
    defaultSort: { field: 'createdAt', dir: 'desc' },
  });
  const [nameFilter,    setNameFilter]    = useState(debouncedName);
  const [statusFilter,  setStatusFilter]  = useState('');

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
  }, [nameFilter, setDebouncedName]);

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

  // ── owners ─────────────────────────────────────────────────────────────────
  const { data: users = [] } = useQuery({ queryKey: ['assignable-users'], queryFn: userService.listAssignableUsers });
  const userMap = useMemo(
    () => new Map(users.map((u) => [u.id, u.fullName])),
    [users],
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
  // Ticked rows (only used when config.selectable). Ids that leave the page (a
  // re-sort can swap them out) stop counting but return with their row, so a
  // selection survives sorting; a change of search or status clears it.
  const pageIds   = useMemo(() => (data?.records ?? []).map((r) => r.id), [data?.records]);
  const selection = useIdSelection(pageIds);
  const selectable = Boolean(config.selectable);
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
    selection.clear();
    setNameFilter('');
    setStatusFilter('');
    setCursor('');
    setPrevCursors([]);
  }

  function handleSort(field: SortField) {
    setSort(field, sortBy === field ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc');
    setCursor('');
    setPrevCursors([]);
  }

  // ── CSV export ─────────────────────────────────────────────────────────────
  // Pages through every record matching the currently applied filters (the same
  // filters/sort as the on-screen query) rather than just the visible page, so
  // an unfiltered download exports the whole table and a filtered one exports
  // only the matching rows.
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  async function handleDownloadCsv() {
    setIsExporting(true);
    setExportError(null);
    try {
      const allRecords: WorkflowRecord[] = [];
      let exportCursor: string | undefined;
      do {
        const page = await crmService.searchRecords(config.workflowKey, {
          filters: filterRequest.filters,
          sort:    filterRequest.sort,
          limit:   EXPORT_PAGE_SIZE,
          cursor:  exportCursor,
        });
        allRecords.push(...page.records);
        exportCursor = page.hasMore ? page.nextCursor : undefined;
      } while (exportCursor);

      downloadCsv(
        buildCrmCsvFilename(config.label),
        buildCrmRecordsCsv(allRecords, statusMap, Boolean(config.showEmail), userMap),
      );
    } catch (err) {
      setExportError(apiErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  }

  function toggleAllOnPage() {
    if (selection.selected.size === pageIds.length) selection.clear();
    else selection.setAll(pageIds);
  }

  // Only the ticked rows, from the page on screen: nothing is fetched.
  function handleExportSelected() {
    const chosen = records.filter((r) => selection.selected.has(r.id));
    downloadCsv(
      buildCrmCsvFilename(config.label),
      buildCrmRecordsCsv(chosen, statusMap, Boolean(config.showEmail)),
    );
  }

  const lowerLabel = config.label.toLowerCase();

  return (
    <div ref={topRef} className="flex flex-col gap-3 scroll-mt-4">

      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center gap-2">

        {/* Search */}
        <div className="relative w-full sm:w-52">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-faint" />
          <input
            type="text"
            placeholder={`Search ${lowerLabel}s…`}
            value={nameFilter}
            onChange={(e) => { setNameFilter(e.target.value); selection.clear(); }}
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150 type-input"
          />
        </div>

        {/* Status filter */}
        <div className="relative w-full sm:w-auto">
          <Select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); setCursor(''); setPrevCursors([]); selection.clear(); }}
            className={cn(
              'h-8 w-full rounded-lg border border-stone-200 bg-white pl-3 pr-7 text-xs focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150 appearance-none',
              statusFilter === '' ? 'text-ink-muted' : 'text-ink-strong',
            )}
            aria-label="Filter by status"
          >
            <option value="">All Statuses</option>
            {statuses.map((s) => (
              <option key={s.stateId} value={s.stateId}>{s.statusLabel}</option>
            ))}
          </Select>
          <ChevronRight className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 size-3 text-ink-faint rotate-90" />
        </div>

        {/* Divider */}
        <div className="h-5 w-px bg-stone-200" aria-hidden="true" />

        {/* Sort chips */}
        <div className="flex items-center gap-1.5">
          <span className="pr-0.5 type-overline">Sort:</span>
          {(Object.entries(SORT_LABELS) as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-micro font-semibold transition-colors',
                sortBy === field
                  ? 'bg-accent text-accent-foreground ring-1 ring-accent-foreground/20'
                  : 'bg-white border border-stone-200 text-ink-muted hover:border-stone-300 hover:text-ink',
              )}
            >
              {label}
              <SortIcon active={sortBy === field} dir={sortDir} />
            </button>
          ))}
        </div>

        {/* Clear filters */}
        {hasFilters && (
          <button
            onClick={clearFilters}
            className={cn(buttonVariants({ variant: 'outline' }), 'flex')}
          >
            <X className="size-3" />
            Clear
          </button>
        )}

        {/* Download CSV */}
        {records.length > 0 && (
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={isExporting}
            aria-label={hasFilters ? `Download filtered ${lowerLabel}s as CSV` : `Download all ${lowerLabel}s as CSV`}
            className={cn(buttonVariants({ variant: 'outline' }), 'ml-auto flex')}
          >
            {isExporting ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Download className="size-3.5" />
            )}
            {isExporting ? 'Exporting…' : hasFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        )}
      </div>

      {isError && (
        <p className="type-error">Failed to load {lowerLabel}s. Please try again.</p>
      )}
      {exportError && (
        <p className="type-error">Failed to export CSV: {exportError}</p>
      )}

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[520px] text-left type-cell">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                {selectable && (
                  <th className="type-th w-10 px-4 py-3">
                    <SelectAllCheckbox selectedCount={selection.selected.size} pageCount={pageIds.length} onToggle={toggleAllOnPage} />
                  </th>
                )}
                <th className="px-4 py-3 type-th">Company</th>
                <th className="px-4 py-3 type-th">Status</th>
                <th className="px-4 py-3 type-th">Owner</th>
                {config.showEmail && (
                  <th className="px-4 py-3 type-th">Email</th>
                )}
                <th className="px-4 py-3 type-th">Created</th>
                {canEdit && (
                  <th className="px-4 py-3 text-right type-th">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {selectable && <td className="w-10 px-4 py-2.5" />}
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <div className="animate-pulse size-8 rounded-full bg-stone-100 shrink-0" />
                        <div className="animate-pulse h-3 rounded bg-stone-100 w-36" />
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><div className="animate-pulse h-3 rounded bg-stone-100 w-24" /></td>
                    <td className="px-4 py-2.5"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    {config.showEmail && <td className="px-4 py-2.5"><div className="animate-pulse h-3 rounded bg-stone-100 w-32" /></td>}
                    <td className="px-4 py-2.5"><div className="animate-pulse h-3 rounded bg-stone-100 w-20" /></td>
                    {canEdit && <td className="px-4 py-2.5" />}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((record) => {
                  const statusInfo = statusMap.get(record.currentStateId);
                  const company    = String(record.coreFields.customer_name ?? '(unnamed)');
                  const email      = String(record.coreFields.customer_contact_email ?? '—');
                  const label      = `${config.label} — ${company}`;
                  const avatar     = companyAvatarVars(company);
                  const approvalState = recordApprovalState(record);
                  const gated      = approvalState === 'pending' || approvalState === 'rejected';
                  return (
                    <tr key={record.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      {selectable && (
                        <td className="w-10 px-4 py-2.5">
                          <SelectRowCheckbox
                            checked={selection.selected.has(record.id)}
                            label={`Select ${company}`}
                            onToggle={() => selection.toggle(record.id)}
                          />
                        </td>
                      )}
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-3">
                          <span
                            className="flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-bold"
                            style={{ backgroundColor: avatar.bg, color: avatar.fg }}
                            aria-hidden="true"
                          >
                            {companyInitials(company)}
                          </span>
                          <div className="min-w-0">
                            <Link
                              to={config.detailPath(record.id)}
                              className="text-left text-xs font-semibold text-ink-strong hover:text-accent-foreground transition-colors truncate max-w-[200px] block"
                            >
                              {company}
                            </Link>
                            {record.recordNumber && (
                              <p className="font-mono mt-0.5 type-helper">{record.recordNumber}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {statusInfo && !canChangeStatusInList ? (
                          <Badge color={resolveStatusColor(statusInfo.stateKey, statusInfo.color)}>{statusInfo.statusLabel}</Badge>
                        ) : statusInfo ? (
                          <StatusDropdown
                            workflowKey={config.workflowKey}
                            recordId={record.id}
                            value={record.currentStateId}
                            onChange={(toStateId) => transition.mutate({ id: record.id, toStateId })}
                            disabled={transition.isPending && transition.variables?.id === record.id}
                            variant="pill"
                            lazy
                            gated={gated}
                          />
                        ) : (
                          <span className="text-xs text-ink-muted">—</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 truncate max-w-[160px] type-cell">
                        {(record.ownerUserId && userMap.get(record.ownerUserId)) || (
                          <span className="text-ink-muted">—</span>
                        )}
                      </td>
                      {config.showEmail && (
                        <td className="px-4 py-2.5 truncate max-w-[180px] type-cell">{email}</td>
                      )}
                      <td className="px-4 py-2.5 tabular-nums whitespace-nowrap type-cell">
                        {new Date(record.createdAt).toLocaleDateString(undefined, LIST_DATE_OPTIONS)}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-2.5 text-right">
                          <Link
                            to={config.editPath(record.id)}
                            aria-label={`Edit ${label}`}
                            className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-ink-muted transition-colors hover:bg-accent hover:border-accent hover:text-accent-foreground cursor-pointer"
                          >
                            <Pencil className="size-4" />
                          </Link>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={4 + (selectable ? 1 : 0) + (config.showEmail ? 1 : 0) + (canEdit ? 1 : 0)} className="py-16 text-center">
                    {!hasFilters ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Inbox className="size-6 text-ink-faint" />
                        </div>
                        <p className="type-card-title">No {lowerLabel}s added yet.</p>
                        <p className="type-helper">Create your first {lowerLabel} to get started.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-ink-faint" />
                        </div>
                        <p className="type-card-title">No {lowerLabel}s match the current filters.</p>
                        <p className="type-helper">Try adjusting your search or status filter.</p>
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

      {selectable && selection.selected.size > 0 && (
        <BulkSelectionBar
          count={selection.selected.size}
          onExport={handleExportSelected}
          onClear={selection.clear}
        />
      )}
    </div>
  );
}
