import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Wallet, Pencil, Filter, ChevronLeft, ChevronRight, ShieldCheck, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { vendorPaymentService } from '@/services/vendorPaymentService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { VP_EDITABLE_STATUSES, VP_STATUS_COLORS } from '@/lib/vendorPaymentForm';
import { exportPagedCsv, fmtCsvDate } from '@/lib/csvExport';
import {
  EMPTY_FILTER_STATE, hasActiveFilters, toFilterClauses, type VendorPaymentFilterState,
} from '@/lib/vendorPaymentFilters';
import { VendorPaymentFilterDrawer } from './VendorPaymentFilterDrawer';
import { ReadOnlyStatusPill } from '@/pages/sales/components/ReadOnlyStatusPill';
import type { VendorPaymentSearchRequest } from '@/types/vendorPayment';
import { formatDateValue, LIST_DATE_OPTIONS } from '@/lib/dateUtils';
import { VendorLink } from '@/pages/purchases/vendor/components/VendorLink';
import { SortIcon } from '@/components/ui/SortIcon';
import { useListUrlState } from '@/hooks/useListUrlState';

import { buttonVariants } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/StatusPill';
// Columns still shown below the sm breakpoint (indexes into the header row); the rest return from sm up.
const PHONE_COLUMNS = new Set([0, 1, 2, 6]);

const EXPORT_PAGE_SIZE = 200;
const PAGE_SIZE = 25;

// Vendor Payments are a dedicated relational module, not a generic CRM/JSONB
// workflow record, so — like Vendor Bill — this table talks to
// vendorPaymentService (/api/tenant/vendor-payments*) directly rather than
// reusing CrmRecordTable/crmService. Mirrors VendorBillTable's search/sort/
// cursor-pagination UX plus the Approval badge column.
//
// Sort buttons deliberately skip `status`/`vendor_id` even though the backend
// allows sorting on them: both are internal integer ids, so their order means
// nothing to a reader (mirrors VendorBillTable).

type SortField = 'paymentDate' | 'amount' | 'unappliedAmount' | 'recordNumber';

const SORT_LABELS: Record<SortField, string> = {
  paymentDate: 'Payment Date',
  amount: 'Amount',
  unappliedAmount: 'Unapplied',
  recordNumber: 'Payment #',
};

const SORT_FIELDS = Object.keys(SORT_LABELS) as SortField[];

const SORT_KEY: Record<SortField, string> = {
  paymentDate: 'payment_date',
  amount: 'amount',
  unappliedAmount: 'unapplied_amount',
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

function fmtDate(iso?: string | null): string {
  if (!iso) return '—';
  return formatDateValue(iso, undefined, LIST_DATE_OPTIONS);
}

export function VendorPaymentTable() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('vendor_payment', 'update');

  const { search: debounced, sortBy, sortDir, setSearch: setDebounced, setSort } = useListUrlState<SortField>({
    sortFields: SORT_FIELDS,
    defaultSort: { field: 'recordNumber', dir: 'desc' },
  });
  const [term, setTerm] = useState(debounced);
  const [filters, setFilters] = useState<VendorPaymentFilterState>(EMPTY_FILTER_STATE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);

  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(term.trim());
      setCursor('');
      setPrevCursors([]);
    }, 300);
    return () => clearTimeout(t);
  }, [term, setDebounced]);

  const req: VendorPaymentSearchRequest = {
    search: debounced || undefined,
    filters: toFilterClauses(filters),
    sort: [{ field: SORT_KEY[sortBy], dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['vendor-payments', req],
    queryFn: () => vendorPaymentService.searchVendorPayments(req),
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

  function applyFilters(next: VendorPaymentFilterState) {
    setFilters(next);
    setCursor('');
    setPrevCursors([]);
  }

  function handleSort(field: SortField) {
    setSort(field, sortBy === field ? (sortDir === 'asc' ? 'desc' : 'asc') : 'desc');
    setCursor('');
    setPrevCursors([]);
  }

  async function handleDownloadCsv() {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportPagedCsv(
        (exportCursor) => vendorPaymentService.searchVendorPayments({ ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor }),
        ['Payment #', 'Vendor', 'Status', 'Approval', 'Method', 'Reference #', 'Payment Date', 'Scheduled Date', 'Amount', 'Applied', 'Unapplied'],
        (payment) => [
          payment.vendorPaymentNumber ?? '',
          payment.vendor?.name ?? '',
          payment.status ?? '',
          APPROVAL_LABELS[payment.approvalStatus] ?? '',
          payment.method ?? '',
          payment.referenceNumber ?? '',
          fmtCsvDate(payment.paymentDate),
          fmtCsvDate(payment.scheduledDate ?? undefined),
          String(payment.amount ?? 0),
          String(payment.appliedTotal ?? 0),
          String(payment.unappliedAmount ?? 0),
        ],
        'Vendor Payment',
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
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-faint" />
          <input
            type="text"
            placeholder="Search payment #, vendor, reference…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            aria-label="Search vendor payments"
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150 type-input"
          />
        </div>

        <button
          onClick={() => setFiltersOpen(true)}
          aria-label="Open filters"
          className={cn(
            'flex items-center gap-1.5 h-8 px-3 rounded-lg border text-xs font-medium transition-colors',
            filtersActive
              ? 'border-brand/40 bg-accent text-accent-foreground'
              : 'border-stone-200 bg-white text-ink-muted hover:bg-stone-50',
          )}
        >
          <Filter className="size-3.5" />
          Filters
        </button>

        <div className="h-5 w-px bg-stone-200" aria-hidden="true" />

        <div className="flex items-center gap-1.5">
          <span className="pr-0.5 type-overline">Sort:</span>
          {(Object.entries(SORT_LABELS) as [SortField, string][]).map(([field, label]) => (
            <button
              key={field}
              onClick={() => handleSort(field)}
              aria-label={`Sort by ${label}`}
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

        {hasFilters && (
          <button
            onClick={clearFilters}
            aria-label="Clear search and filters"
            className={cn(buttonVariants({ variant: 'outline' }), 'flex')}
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
            aria-label={hasFilters ? 'Download filtered vendor payments as CSV' : 'Download all vendor payments as CSV'}
            className={cn(buttonVariants({ variant: 'outline' }), 'ml-auto flex')}
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : hasFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        )}
      </div>

      {isError && (
        <p role="alert" className="type-error">
          {apiErrorMessage(error, 'Failed to load vendor payments. Please try again.')}
        </p>
      )}
      {exportError && (
        <p role="alert" className="type-error">Failed to export CSV: {exportError}</p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full sm:min-w-[1020px] text-left type-cell">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 max-sm:px-2 py-3 type-th">Payment #</th>
                <th className="px-4 max-sm:px-2 py-3 type-th">Vendor</th>
                <th className="px-4 max-sm:px-2 py-3 type-th">Status</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">Approval</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">Method</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">Payment Date</th>
                <th className="px-4 max-sm:px-2 py-3 text-right type-th">Amount</th>
                <th className="px-4 max-sm:px-2 py-3 text-right max-sm:hidden type-th">Unapplied</th>
                {canEdit && (
                  <th className="px-4 max-sm:px-2 py-3 text-right max-sm:hidden type-th">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: canEdit ? 9 : 8 }, (_, j) => (
                      <td key={j} className={cn('px-4 max-sm:px-2 py-2.5', !PHONE_COLUMNS.has(j) && 'max-sm:hidden')}><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    ))}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((payment) => {
                  const approvalLabel = APPROVAL_LABELS[payment.approvalStatus];
                  return (
                    <tr key={payment.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 max-sm:px-2 py-2.5">
                        <Link
                          to={`/purchases/vendor_payment/${payment.id}`}
                          className="whitespace-nowrap hover:text-accent-foreground transition-colors type-record-id"
                        >
                          {payment.vendorPaymentNumber || '—'}
                        </Link>
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 truncate max-w-[200px] type-cell-strong">
                        <VendorLink vendor={payment.vendor} />
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5">
                        <ReadOnlyStatusPill label={payment.status} color={VP_STATUS_COLORS[payment.statusCode]} />
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 max-sm:hidden">
                        {approvalLabel ? (
                          <StatusPill color={APPROVAL_COLORS[payment.approvalStatus]} dot={false}><ShieldCheck className="size-2.5" aria-hidden="true" />
                            {approvalLabel}</StatusPill>
                        ) : (
                          <span className="type-subline">—</span>
                        )}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 whitespace-nowrap max-sm:hidden type-cell">
                        {payment.method || '—'}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 tabular-nums whitespace-nowrap max-sm:hidden type-cell">
                        {fmtDate(payment.paymentDate)}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 tabular-nums text-right whitespace-nowrap type-cell-strong">
                        {currency(payment.amount)}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 tabular-nums text-right whitespace-nowrap max-sm:hidden type-cell-strong">
                        {currency(payment.unappliedAmount)}
                      </td>
                      {canEdit && (
                        <td className="px-4 max-sm:px-2 py-2.5 text-right max-sm:hidden">
                          {VP_EDITABLE_STATUSES.has(payment.statusCode) ? (
                            <button
                              type="button"
                              onClick={() => navigate(`/purchases/vendor_payment/${payment.id}/edit`)}
                              aria-label={`Edit vendor payment ${payment.vendorPaymentNumber}`}
                              className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-ink-muted transition-colors hover:bg-accent hover:border-accent hover:text-accent-foreground cursor-pointer"
                            >
                              <Pencil className="size-4" />
                            </button>
                          ) : (
                            <span className="type-subline">—</span>
                          )}
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
                          <Wallet className="size-6 text-ink-faint" />
                        </div>
                        <p className="type-card-title">No vendor payments recorded yet.</p>
                        <p className="type-helper">Record your first vendor payment to get started.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-ink-faint" />
                        </div>
                        <p className="type-card-title">No vendor payments match the current search.</p>
                        <p className="type-helper">Try adjusting your search or filters.</p>
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

      {filtersOpen && (
        <VendorPaymentFilterDrawer
          onClose={() => setFiltersOpen(false)}
          value={filters}
          onApply={applyFilters}
        />
      )}
    </div>
  );
}
