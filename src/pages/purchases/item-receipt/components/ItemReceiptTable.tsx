import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, X, Inbox, Pencil, Filter, ChevronLeft, ChevronRight, Download, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { apiErrorMessage } from '@/api/tenantClient';
import { itemReceiptService } from '@/services/itemReceiptService';
import { lookupService } from '@/services/lookupService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { IR_STATUS_COLORS, IR_EDITABLE_STATUSES } from '@/lib/itemReceiptForm';
import { exportPagedCsv, fmtCsvDate } from '@/lib/csvExport';
import {
  EMPTY_FILTER_STATE, hasActiveFilters, toFilterClauses, type ItemReceiptFilterState,
} from '@/lib/itemReceiptFilters';
import { ItemReceiptFilterDrawer } from './ItemReceiptFilterDrawer';
import type { ItemReceiptSearchRequest } from '@/types/itemReceipt';
import { formatDateValue, LIST_DATE_OPTIONS } from '@/lib/dateUtils';
import { VendorLink } from '@/pages/purchases/vendor/components/VendorLink';
import { SortIcon } from '@/components/ui/SortIcon';
import { useListUrlState } from '@/hooks/useListUrlState';

import { buttonVariants } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/StatusPill';
// Columns still shown below the sm breakpoint (indexes into the header row); the rest return from sm up.
const PHONE_COLUMNS = new Set([0, 2, 3]);

const EXPORT_PAGE_SIZE = 200;

// Item Receipts are a dedicated relational module, not a generic CRM/JSONB
// workflow record — mirrors PurchaseOrderTable's search/sort/cursor-
// pagination UX and filter drawer. `status` is filter-only server-side (spec
// §3), so it's a display column here, never a sort chip.

type SortField = 'recordNumber' | 'receiptDate' | 'warehouseId';

const PAGE_SIZE = 25;

const SORT_LABELS: Record<SortField, string> = {
  recordNumber: 'Receipt #',
  receiptDate: 'Receipt Date',
  warehouseId: 'Location',
};

const SORT_FIELDS = Object.keys(SORT_LABELS) as SortField[];

const SORT_KEY: Record<SortField, string> = {
  recordNumber: 'record_number',
  receiptDate: 'receipt_date',
  warehouseId: 'warehouse_id',
};

function fmtDate(iso?: string): string {
  if (!iso) return '—';
  return formatDateValue(iso, undefined, LIST_DATE_OPTIONS);
}

export function ItemReceiptTable() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('item_receipt', 'update');

  const { search: debounced, sortBy, sortDir, setSearch: setDebounced, setSort } = useListUrlState<SortField>({
    sortFields: SORT_FIELDS,
    defaultSort: { field: 'recordNumber', dir: 'desc' },
  });
  const [term, setTerm] = useState(debounced);
  const [filters, setFilters] = useState<ItemReceiptFilterState>(EMPTY_FILTER_STATE);
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
  }, [term, setDebounced]);

  const req: ItemReceiptSearchRequest = {
    search: debounced || undefined,
    filters: toFilterClauses(filters),
    sort: [{ field: SORT_KEY[sortBy], dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['item-receipts', req],
    queryFn: () => itemReceiptService.searchItemReceipts(req),
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

  function applyFilters(next: ItemReceiptFilterState) {
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
        (exportCursor) => itemReceiptService.searchItemReceipts({ ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor }),
        ['Receipt #', 'PO #', 'Vendor', 'Status', 'Receipt Date', 'Location', 'Owner'],
        (ir) => [
          ir.itemReceiptNumber ?? '',
          ir.purchaseOrder?.number ?? '',
          ir.vendor?.name ?? '',
          ir.status ?? '',
          fmtCsvDate(ir.receiptDate),
          ir.warehouseName ?? '',
          (ir.ownerEmployeeId ? employeeNames.get(String(ir.ownerEmployeeId)) : undefined) ?? '',
        ],
        'Item Receipt',
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
            placeholder="Search receipt #, packing slip, tracking, PO #…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150 type-input"
          />
        </div>

        <button
          onClick={() => setFiltersOpen(true)}
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
            aria-label={hasFilters ? 'Download filtered item receipts as CSV' : 'Download all item receipts as CSV'}
            className={cn(buttonVariants({ variant: 'outline' }), 'ml-auto flex')}
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : hasFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        )}
      </div>

      {isError && (
        <p className="type-error">{apiErrorMessage(error, 'Failed to load item receipts. Please try again.')}</p>
      )}
      {exportError && (
        <p className="type-error">Failed to export CSV: {exportError}</p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full sm:min-w-[920px] text-left type-cell">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 max-sm:px-2 py-3 type-th">Receipt #</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">PO #</th>
                <th className="px-4 max-sm:px-2 py-3 type-th">Vendor</th>
                <th className="px-4 max-sm:px-2 py-3 type-th">Status</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">Receipt Date</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">Location</th>
                <th className="px-4 max-sm:px-2 py-3 max-sm:hidden type-th">Owner</th>
                {canEdit && (
                  <th className="px-4 max-sm:px-2 py-3 text-right max-sm:hidden type-th">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: canEdit ? 8 : 7 }, (_, j) => (
                      <td key={j} className={cn('px-4 max-sm:px-2 py-2.5', !PHONE_COLUMNS.has(j) && 'max-sm:hidden')}><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    ))}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((ir) => {
                  const color = IR_STATUS_COLORS[ir.statusCode] ?? '#a8a29e';
                  const ownerName = ir.ownerEmployeeId ? employeeNames.get(String(ir.ownerEmployeeId)) : undefined;
                  const editable = canEdit && IR_EDITABLE_STATUSES.has(ir.statusCode);
                  return (
                    <tr key={ir.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 max-sm:px-2 py-2.5">
                        <Link
                          to={`/purchases/item_receipt/${ir.id}`}
                          className="whitespace-nowrap hover:text-accent-foreground transition-colors type-record-id"
                        >
                          {ir.itemReceiptNumber || '—'}
                        </Link>
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 max-sm:hidden type-cell">
                        {ir.purchaseOrder?.number ?? '—'}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 truncate max-w-[180px] type-cell-strong">
                        <VendorLink vendor={ir.vendor} />
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5">
                        <StatusPill color={color}>{ir.status}</StatusPill>
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 tabular-nums whitespace-nowrap max-sm:hidden type-cell">
                        {fmtDate(ir.receiptDate)}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 truncate max-w-[140px] max-sm:hidden type-cell">
                        {ir.warehouseName || '—'}
                      </td>
                      <td className="px-4 max-sm:px-2 py-2.5 truncate max-w-[140px] max-sm:hidden type-cell">
                        {ownerName ?? '—'}
                      </td>
                      {canEdit && (
                        <td className="px-4 max-sm:px-2 py-2.5 text-right max-sm:hidden">
                          {editable && (
                            <button
                              type="button"
                              onClick={() => navigate(`/purchases/item_receipt/${ir.id}/edit`)}
                              aria-label={`Edit item receipt ${ir.itemReceiptNumber}`}
                              className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-ink-muted transition-colors hover:bg-accent hover:border-accent hover:text-accent-foreground cursor-pointer"
                            >
                              <Pencil className="size-4" />
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7 + (canEdit ? 1 : 0)} className="py-16 text-center">
                    {!hasFilters ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Inbox className="size-6 text-ink-faint" />
                        </div>
                        <p className="type-card-title">No item receipts added yet.</p>
                        <p className="type-helper">Receive against a purchase order to get started.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-ink-faint" />
                        </div>
                        <p className="type-card-title">No item receipts match the current search.</p>
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
        <ItemReceiptFilterDrawer
          onClose={() => setFiltersOpen(false)}
          value={filters}
          onApply={applyFilters}
        />
      )}
    </div>
  );
}
