import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronsDown, ChevronsUp, Download } from 'lucide-react';
import { accountingPeriodService } from '@/services/accountingPeriodService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { Spinner, ErrorNote, EmptyState } from '@/components/tenant/ui';
import { apiErrorMessage } from '@/api/tenantClient';
import { buildCsvText, buildCsvFilename, downloadCsv } from '@/lib/csvExport';
import { buildFiscalYearTree, flattenTree, allGroupKeys, formatDateRange } from '@/lib/accountingPeriodTree';
import type { AccountingCalendar, Period } from '@/types/accountingPeriod';
import { PeriodTreeRow } from './PeriodTreeRow';
import { PeriodBulkActionBar } from './PeriodBulkActionBar';
import { PeriodStatusDialog } from './PeriodStatusDialog';
import { PeriodHistoryDrawer } from './PeriodHistoryDrawer';

const COLUMN_HEADERS = [
  'Date Range', 'Period Name', 'Period Close',
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
  const [statusTarget, setStatusTarget] = useState<Period | null>(null);
  const [historyTarget, setHistoryTarget] = useState<Period | null>(null);

  const {
    data: fiscalYears = [], isLoading: fyLoading, isError: fyIsError, error: fyError,
  } = useQuery({ queryKey: ['ap-fiscal-years'], queryFn: accountingPeriodService.listFiscalYears });

  const {
    data: periods = [], isLoading: periodsLoading, isError: periodsIsError, error: periodsError,
  } = useQuery({ queryKey: ['ap-periods'], queryFn: () => accountingPeriodService.listPeriods() });

  const tree = useMemo(() => buildFiscalYearTree(fiscalYears, periods), [fiscalYears, periods]);
  const rows = useMemo(() => flattenTree(tree, collapsed), [tree, collapsed]);

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

  function handleDownloadCsv() {
    const text = buildCsvText(
      ['Fiscal Year', 'Period', 'Date Range', 'Status'],
      periods.map((p) => [p.fiscalYearName, p.name, formatDateRange(p.start, p.end), p.status]),
    );
    downloadCsv(buildCsvFilename('accounting-period'), text);
  }

  const isLoading = fyLoading || periodsLoading;
  const isError = fyIsError || periodsIsError;

  if (isLoading) return <Spinner label="Loading accounting periods…" />;
  if (isError) {
    return <ErrorNote>{apiErrorMessage(fyError ?? periodsError, 'Failed to load accounting periods.')}</ErrorNote>;
  }
  if (tree.length === 0) return <EmptyState>No fiscal years have been generated yet.</EmptyState>;

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
        <table className="w-full min-w-[860px] text-left text-xs">
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
                onOpenStatusDialog={setStatusTarget}
                onOpenHistory={setHistoryTarget}
              />
            ))}
          </tbody>
        </table>
      </div>

      {statusTarget && <PeriodStatusDialog period={statusTarget} onClose={() => setStatusTarget(null)} />}
      {historyTarget && <PeriodHistoryDrawer period={historyTarget} onClose={() => setHistoryTarget(null)} />}
    </div>
  );
}
