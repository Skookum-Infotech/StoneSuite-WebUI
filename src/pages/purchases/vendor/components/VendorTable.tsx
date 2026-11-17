import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, ArrowUp, ArrowDown, ArrowUpDown, X, Inbox, Pencil,
  ChevronLeft, ChevronRight, User, Building2, Download, Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { vendorService } from '@/services/vendorService';
import { apiErrorMessage } from '@/api/tenantClient';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { VENDOR_STATUS_COLORS } from '@/types/vendor';
import { exportPagedCsv } from '@/lib/csvExport';
import type { VendorSearchRequest } from '@/types/vendor';

import { buttonVariants } from '@/components/ui/button';
import { StatusPill } from '@/components/ui/StatusPill';
const EXPORT_PAGE_SIZE = 200;

// Vendors are a dedicated relational module (mirrors salesorder), not a
// generic CRM/JSONB workflow record, so this table talks to vendorService
// (/api/tenant/vendors*) directly. Mirrors SalesOrderTable's
// search/sort/cursor-pagination UX for visual consistency.

type SortField = 'createdAt' | 'updatedAt' | 'vendorNumber';
type SortDir = 'asc' | 'desc';

const PAGE_SIZE = 25;

const SORT_LABELS: Record<SortField, string> = {
  createdAt: 'Date Created',
  updatedAt: 'Last Updated',
  vendorNumber: 'Vendor #',
};

// Only fields vendors.resolver.go whitelists for ORDER BY (record_number is
// the built-in alias for vendor_number).
const SORT_KEY: Record<SortField, string> = {
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  vendorNumber: 'record_number',
};

export function VendorTable() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canEdit = permissionsLoading || hasPermission('vendor', 'update');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [sortBy, setSortBy] = useState<SortField>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

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
  }, [term]);

  const req: VendorSearchRequest = {
    search: debounced || undefined,
    sort: [{ field: SORT_KEY[sortBy], dir: sortDir }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError } = useQuery({
    queryKey: ['vendors', req],
    queryFn: () => vendorService.searchVendors(req),
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

  const hasFilters = Boolean(term);

  function clearFilters() {
    setTerm('');
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
        (exportCursor) => vendorService.searchVendors({ ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor }),
        ['Vendor #', 'Name', 'Type', 'Status', 'Email'],
        (vendor) => [
          vendor.vendorNumber ?? '',
          vendor.displayName ?? '',
          vendor.vendorType ?? '',
          vendor.status ?? '',
          vendor.email ?? '',
        ],
        'Vendor',
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
            placeholder="Search vendor #, name, email…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 placeholder:text-stone-500 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all duration-150 type-input"
          />
        </div>

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
            aria-label={hasFilters ? 'Download filtered vendors as CSV' : 'Download all vendors as CSV'}
            className={cn(buttonVariants({ variant: 'outline' }), 'ml-auto flex')}
          >
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : hasFilters ? 'Download filtered CSV' : 'Download CSV'}
          </button>
        )}
      </div>

      {isError && (
        <p className="type-error">Failed to load vendors. Please try again.</p>
      )}
      {exportError && (
        <p className="type-error">Failed to export CSV: {exportError}</p>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 py-3 type-th">Vendor #</th>
                <th className="px-4 py-3 type-th">Name</th>
                <th className="px-4 py-3 type-th">Type</th>
                <th className="px-4 py-3 type-th">Status</th>
                <th className="px-4 py-3 type-th">Email</th>
                {canEdit && (
                  <th className="px-4 py-3 text-right type-th">Actions</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-36" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-20" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>
                    <td className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-32" /></td>
                    {canEdit && <td className="px-4 py-3" />}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((vendor) => {
                  const TypeIcon = vendor.vendorType === 'Person' ? User : Building2;
                  const statusColor = VENDOR_STATUS_COLORS[vendor.status] ?? '#a8a29e';
                  return (
                    <tr key={vendor.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 py-3.5">
                        <Link
                          to={`/purchases/vendor/${vendor.id}`}
                          className="whitespace-nowrap hover:text-accent-foreground transition-colors type-record-id"
                        >
                          {vendor.vendorNumber || '—'}
                        </Link>
                      </td>
                      <td className="px-4 py-3.5 truncate max-w-[240px] type-cell-strong">
                        {vendor.displayName}
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-stone-100 px-2.5 py-1 text-stone-600 whitespace-nowrap type-pill">
                          <TypeIcon className="size-3" />
                          {vendor.vendorType}
                        </span>
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusPill color={statusColor}>{vendor.status}</StatusPill>
                      </td>
                      <td className="px-4 py-3.5 whitespace-nowrap type-cell">
                        {vendor.email || '—'}
                      </td>
                      {canEdit && (
                        <td className="px-4 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => navigate(`/purchases/vendor/${vendor.id}/edit`)}
                            aria-label={`Edit vendor ${vendor.displayName}`}
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
                  <td colSpan={5 + (canEdit ? 1 : 0)} className="py-16 text-center">
                    {!hasFilters ? (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Inbox className="size-6 text-stone-400" />
                        </div>
                        <p className="type-card-title">No vendors added yet.</p>
                        <p className="type-helper">Create your first vendor to get started.</p>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-3">
                        <div className="rounded-2xl bg-stone-100 p-4">
                          <Search className="size-6 text-stone-400" />
                        </div>
                        <p className="type-card-title">No vendors match the current search.</p>
                        <p className="type-helper">Try adjusting your search terms.</p>
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
    </div>
  );
}
