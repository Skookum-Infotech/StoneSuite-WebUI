import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, X, FileCheck, Pencil, Filter,
  ChevronLeft, ChevronRight, ShieldCheck, Download, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { vendorBillService } from '@/services/vendorBillService';
import { lookupService } from '@/services/lookupService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { VB_STATUS_COLORS } from '@/lib/vendorBillForm';
import { exportPagedCsv, fmtCsvDate } from '@/lib/csvExport';
import {
  EMPTY_FILTER_STATE, hasActiveFilters, toFilterClauses, type VendorBillFilterState,
} from '@/lib/vendorBillFilters';
import { VendorBillFilterDrawer } from './VendorBillFilterDrawer';
import type { VendorBillSearchRequest } from '@/types/vendorBill';

const EXPORT_PAGE_SIZE = 200;

// Vendor Bills are a dedicated relational module, not a generic CRM/JSONB
// workflow record, so — like Purchase Order — this table talks to
// vendorBillService (/api/tenant/vendor-bills*) directly rather than reusing
// CrmRecordTable/crmService. Mirrors PurchaseOrderTable's search/sort/
// cursor-pagination UX, plus a filter drawer and the Approval badge column.
// Sort buttons deliberately skip `status`/`vendor_id` even though the
// backend allows sorting on them (they're internal integer ids/ordinals, not
// meaningful to sort by from the UI) — mirrors PurchaseOrderTable.

type SortField = 'billDate' | 'grandTotal' | 'balanceDue' | 'recordNumber';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

const SORT_LABELS: Record<SortField, string> = {
  billDate: 'Bill Date',
  grandTotal: 'Amount',
  balanceDue: 'Balance Due',
  recordNumber: 'Bill #',
};

const SORT_KEY: Record<SortField, string> = {
  billDate: 'bill_date',
  grandTotal: 'grand_total',
  balanceDue: 'balance_due',
  recordNumber: 'record_number',
};

const APPROVAL_LABELS: Record<string, string> = {
  pending: 'Pending Approval',
  approved: 'Approved',
};
const APPROVAL_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  approved: '#22c55e',
};

function currency(n: number | undefined): string {
  return (n ?? 0).toLocaleString(undefined, { style: 'currency', currency: 'USD' });
}

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, { year: '2-digit', month: 'short', day: 'numeric' });
}

export function VendorBillTable() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('vendor_bill', 'update');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('billDate');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [filters, setFilters] = useState<VendorBillFilterState>(EMPTY_FILTER_STATE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { data: lookups } = useQuery({
    queryKey: ['crm-lookups'],
    queryFn: lookupService.getCrmLookups,
    staleTime: 10 * 60 * 1000,
  });
  const employeeNames = new Map((lookups?.employees ?? []).map((e) => [String(e.id), e.name]));

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(term.trim());
      setCursor('');
      setPrevCursors([]);
    }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const req: VendorBillSearchRequest = {
    search: debounced || undefined,
    filters: toFilterClauses(filters),
    sort: [{ field: SORT_KEY[sortBy], dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['vendor-bills', req],
    queryFn: () => vendorBillService.searchVendorBills(req),
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

  const filtersActive = hasActiveFilters(filters);
  const hasFilters = Boolean(term) || filtersActive;

  function clearFilters() {
    setTerm('');
    setFilters(EMPTY_FILTER_STATE);
    setCursor('');
    setPrevCursors([]);
  }

  function applyFilters(next: VendorBillFilterState) {
    setFilters(next);
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

  async function handleDownloadCsv() {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportPagedCsv(
        (exportCursor) => vendorBillService.searchVendorBills({ ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor }),
        ['Bill #', "Vendor's Invoice #", 'Vendor', 'Status', 'Approval', 'Bill Date', 'Due Date', 'Owner', 'Grand Total', 'Amount Paid', 'Balance Due'],
        (bill) => [
          bill.vendorBillNumber ?? '',
          bill.vendorInvoiceNumber ?? '',
          bill.vendor?.name ?? '',
          bill.status ?? '',
          APPROVAL_LABELS[bill.approvalStatus] ?? '',
          fmtCsvDate(bill.billDate),
          fmtCsvDate(bill.dueDate),
          (bill.ownerEmployeeId ? employeeNames.get(String(bill.ownerEmployeeId)) : undefined) ?? '',
          String(bill.grandTotal ?? 0),
          String(bill.amountPaid ?? 0),
          String(bill.balanceDue ?? 0),
        ],
        'Vendor Bill',
      );
    } catch (err) {
      setExportError(apiErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div ref={topRef} className="flex flex-col gap-3 scroll-mt-4">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
          <input
            type="text"
            placeholder="Search bill #, vendor, invoice #…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150"
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

        <div className="h-5 w-px bg-stone-200" aria-hidden="true" />

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
            aria-label={hasFilters ? 'Download filtered vendor bills as CSV' : 'Download all vendor bills as CSV'}
            className="ml-auto flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : hasFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        )}
      </div>

      {isError && (
        <p className="text-xs text-red-500">{apiErrorMessage(error, 'Failed to load vendor bills. Please try again.')}</p>
      )}
      {exportError && (
        <p className="text-xs text-red-500">Failed to export CSV: {exportError}</p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[980px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Bill #</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Vendor</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Approval</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Bill Date</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Due Date</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Owner</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Grand Total</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Balance Due</th>
                {canEdit && (
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: canEdit ? 10 : 9 }, (_, j) => (
                      <td key={j} className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    ))}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((bill) => {
                  const color = VB_STATUS_COLORS[bill.statusCode] ?? '#a8a29e';
                  const approvalLabel = APPROVAL_LABELS[bill.approvalStatus];
                  const ownerName = bill.ownerEmployeeId ? employeeNames.get(String(bill.ownerEmployeeId)) : undefined;
                  return (
                    <tr key={bill.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 py-3.5">
                        <button
                          type="button"
                          onClick={() => navigate(`/purchases/vendor_bill/${bill.id}`)}
                          className="font-mono text-xs font-semibold text-stone-900 hover:text-accent-foreground transition-colors"
                        >
                          {bill.vendorBillNumber || '—'}
                        </button>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-700 truncate max-w-[200px]">
                        {bill.vendor?.name ?? '—'}
                      </td>
                      <td className="px-4 py-3.5">
                        <span
                          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-stone-600 whitespace-nowrap"
                          style={{ backgroundColor: `${color}18` }}
                        >
                          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
                          {bill.status}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        {approvalLabel ? (
                          <span
                            className="inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-2xs font-semibold whitespace-nowrap"
                            style={{ backgroundColor: `${APPROVAL_COLORS[bill.approvalStatus]}18`, color: APPROVAL_COLORS[bill.approvalStatus] }}
                          >
                            <ShieldCheck className="size-2.5" aria-hidden="true" />
                            {approvalLabel}
                          </span>
                        ) : (
                          <span className="text-2xs text-stone-300">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-400 tabular-nums whitespace-nowrap">
                        {fmtDate(bill.billDate)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-400 tabular-nums whitespace-nowrap">
                        {fmtDate(bill.dueDate)}
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-500 truncate max-w-[140px]">
                        {ownerName ?? '—'}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-stone-900 tabular-nums text-right whitespace-nowrap">
                        {currency(bill.grandTotal)}
                      </td>
                      <td className="px-4 py-3.5 text-xs font-semibold text-stone-900 tabular-nums text-right whitespace-nowrap">
                        {currency(bill.balanceDue)}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/purchases/vendor_bill/${bill.id}/edit`)}
                            aria-label={`Edit vendor bill ${bill.vendorBillNumber}`}
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
                  <td colSpan={9 + (canEdit ? 1 : 0)} className="py-16 text-center">
                    {!hasFilters ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <FileCheck className="size-6 text-stone-400" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700">No vendor bills added yet.</p>
                        <p className="text-xs text-stone-400">Create your first vendor bill to get started.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-stone-400" />
                        </div>
                        <p className="text-sm font-semibold text-stone-700">No vendor bills match the current search.</p>
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
        <VendorBillFilterDrawer
          onClose={() => setFiltersOpen(false)}
          value={filters}
          onApply={applyFilters}
        />
      )}
    </div>
  );
}
