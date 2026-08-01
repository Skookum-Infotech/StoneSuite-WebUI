import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsDown, ChevronsUp, Download, X } from 'lucide-react';
import { accountingPeriodService } from '@/services/accountingPeriodService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { apiErrorMessage } from '@/api/tenantClient';
import { buildCsvText, buildCsvFilename, downloadCsv } from '@/lib/csvExport';
import { buildFiscalYearTree, flattenTree, allGroupKeys, formatDateRange } from '@/lib/accountingPeriodTree';
import type { AccountingCalendar, LockTarget, Period, PeriodStatus } from '@/types/accountingPeriod';
import { PeriodTreeRow } from './PeriodTreeRow';
import { PeriodBulkActionBar } from './PeriodBulkActionBar';
import { PeriodStatusDialog } from './PeriodStatusDialog';
import { PeriodHistoryDrawer } from './PeriodHistoryDrawer';

const filterSelectCls =
  'h-8 rounded-lg border border-stone-200 bg-white px-2.5 text-xs text-stone-700 transition-colors focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand';

const COLUMN_HEADERS = [
  'Period Name', 'Period Close',
  'A/P Transactions', 'A/R Transactions', 'All G/L Transactions', 'Allow Non-G/L Changes',
] as const;

// The FY -> quarter -> month tree (per the reference layout), backed by
// listFiscalYears (for status + date span, derived server-side) and
// listPeriods (the flat, chronologically-ordered leaf rows) grouped together
// by the pure accountingPeriodTree helpers.
export function PeriodTreeTable({ calendar }: { calendar: AccountingCalendar }) {
  const { hasPermission, isLoading: permsLoading } = useUserPermissions();
  const canUpdate = permsLoading || hasPermission('accounting_period', 'update');

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Which period, and which of its four lockable dimensions, the confirm
  // dialog is open for — the three sub-ledger locks each act independently.
  const [statusTarget, setStatusTarget] = useState<{ period: Period; target: LockTarget } | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Period | null>(null);
  const [fiscalYearFilter, setFiscalYearFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | PeriodStatus>('');

  const {
    data: fiscalYears = [], isLoading: fyLoading, isError: fyIsError, error: fyError,
  } = useQuery({ queryKey: ['ap-fiscal-years'], queryFn: accountingPeriodService.listFiscalYears });

  const {
    data: periods = [], isLoading: periodsLoading, isError: periodsIsError, error: periodsError,
  } = useQuery({
    queryKey: ['ap-periods', fiscalYearFilter, statusFilter],
    queryFn: () => accountingPeriodService.listPeriods({
      fiscalYear: fiscalYearFilter || undefined,
      status: statusFilter || undefined,
    }),
  });

  // Drop a fiscal year from the tree once its periods are filtered away —
  // otherwise a "Status: closed" filter would still show every year as an
  // empty row instead of just the ones that actually have a closed period.
  const yearsWithVisiblePeriods = useMemo(() => {
    const ids = new Set(periods.map((p) => p.fiscalYearId));
    return fiscalYears.filter((fy) => ids.has(fy.id));
  }, [fiscalYears, periods]);

  const tree = useMemo(() => buildFiscalYearTree(yearsWithVisiblePeriods, periods), [yearsWithVisiblePeriods, periods]);
  const rows = useMemo(() => flattenTree(tree, collapsed), [tree, collapsed]);
  const filtersActive = Boolean(fiscalYearFilter || statusFilter);

  function clearFilters() {
    setFiscalYearFilter('');
    setStatusFilter('');
    setSelectedIds(new Set());
  }

  // A filter change can scroll previously-selected rows out of the result
  // set entirely, so the selection is cleared alongside it rather than left
  // pointing at periods the bulk bar can no longer show.
  function handleFiscalYearFilterChange(value: string) {
    setFiscalYearFilter(value);
    setSelectedIds(new Set());
  }

  function handleStatusFilterChange(value: '' | PeriodStatus) {
    setStatusFilter(value);
    setSelectedIds(new Set());
  }

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Quarter is blank for periods generated before fiscal_quarter existed —
  // they are deliberately not backfilled, so the export reports the absence
  // rather than substituting the client-derived tree label.
  function handleDownloadCsv() {
    const text = buildCsvText(
      ['Fiscal Year', 'Quarter', 'Period', 'Date Range', 'Status', 'A/P Lock', 'A/R Lock', 'G/L Lock'],
      periods.map((p) => [
        p.fiscalYearName, p.quarterName ?? '', p.name, formatDateRange(p.start, p.end),
        p.status, p.apLockStatus, p.arLockStatus, p.glLockStatus,
      ]),
    );
    downloadCsv(buildCsvFilename('accounting-period'), text);
  }

  const isLoading = fyLoading || periodsLoading;
  const isError = fyIsError || periodsIsError;

  if (isLoading) return <Spinner label="Loading accounting periods…" />;
  if (isError) {
    return <ErrorNote>{apiErrorMessage(fyError ?? periodsError, 'Failed to load accounting periods.')}</ErrorNote>;
  }
  if (tree.length === 0) {
    return (
      <EmptyState>
        {fiscalYears.length === 0 ? 'No fiscal years have been generated yet.' : 'No periods match the current filters.'}
      </EmptyState>
    );
  }

  const selectedPeriods = periods.filter((p) => selectedIds.has(p.id));

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => setCollapsed(new Set())}
          aria-label="Expand all fiscal years and quarters"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-800"
        >
          <ChevronsDown className="size-3.5" /> Expand All
        </button>
        <span className="text-stone-300" aria-hidden="true">|</span>
        <button
          type="button"
          onClick={() => setCollapsed(new Set(allGroupKeys(tree)))}
          aria-label="Collapse all fiscal years and quarters"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-800"
        >
          <ChevronsUp className="size-3.5" /> Collapse All
        </button>

        <div className="h-5 w-px bg-stone-200" aria-hidden="true" />

        <select
          value={fiscalYearFilter}
          onChange={(e) => handleFiscalYearFilterChange(e.target.value)}
          aria-label="Filter by fiscal year"
          className={filterSelectCls}
        >
          <option value="">All fiscal years</option>
          {fiscalYears.map((fy) => (
            <option key={fy.id} value={fy.name}>{fy.name}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => handleStatusFilterChange(e.target.value as '' | PeriodStatus)}
          aria-label="Filter by status"
          className={filterSelectCls}
        >
          <option value="">All statuses</option>
          <option value="open">Open</option>
          <option value="closed">Closed</option>
        </select>

        {filtersActive && (
          <button
            type="button"
            onClick={clearFilters}
            aria-label="Clear filters"
            className="inline-flex h-8 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs text-stone-500 transition-colors hover:bg-stone-50"
          >
            <X className="size-3" />
            Clear
          </button>
        )}

        <button
          type="button"
          onClick={handleDownloadCsv}
          aria-label="Download accounting periods as CSV"
          className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50"
        >
          <Download className="size-3.5" />
          Download CSV
        </button>
      </div>

      {canUpdate && <PeriodBulkActionBar selectedPeriods={selectedPeriods} onClear={() => setSelectedIds(new Set())} />}

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-stone-200 bg-white shadow-sm modal-scrollbar">
        <table className="w-full min-w-[760px] text-left text-xs">
          <thead className="sticky top-0 z-10 border-b border-stone-200 bg-table-header">
            <tr>
              {canUpdate && <th className="w-8 px-3 py-3" />}
              {COLUMN_HEADERS.map((h) => (
                <th key={h} className="whitespace-nowrap px-4 py-3 text-2xs font-semibold uppercase tracking-wider text-stone-500">
                  {h}
                </th>
              ))}
              <th className="w-10 px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-50">
            {rows.map((row) => (
              <PeriodTreeRow
                key={row.key}
                row={row}
                basePeriodStart={calendar.basePeriodStart}
                canUpdate={canUpdate}
                selectedIds={selectedIds}
                onToggleGroup={toggleGroup}
                onToggleSelect={toggleSelect}
                onOpenStatusDialog={(period, target) => setStatusTarget({ period, target })}
                onOpenHistory={setHistoryTarget}
              />
            ))}
          </tbody>
        </table>
      </div>

      {statusTarget && (
        <PeriodStatusDialog
          period={statusTarget.period}
          target={statusTarget.target}
          onClose={() => setStatusTarget(null)}
        />
      )}
      {historyTarget && <PeriodHistoryDrawer period={historyTarget} onClose={() => setHistoryTarget(null)} />}
    </div>
  );
}
