import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeftRight, ChevronLeft, ChevronRight, Download, Loader2, Search, X } from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { binTransferService } from '@/services/binTransferService';
import { Badge } from '@/components/tenant/ui';
import { exportPagedCsv } from '@/lib/csvExport';
import { formatDateValue, LIST_DATE_OPTIONS } from '@/lib/dateUtils';
import { BT_STATUS_CODES, BT_STATUS_COLORS } from '@/lib/binTransferStatus';
import { cn } from '@/lib/utils';
import type { BinTransferRecord, BinTransferSearchRequest } from '@/types/binTransfer';

const PAGE_SIZE = 25;
const EXPORT_PAGE_SIZE = 200;
const SEARCH_DEBOUNCE_MS = 300;
const COLUMN_COUNT = 7;

const CHIPS = [{ code: '', label: 'All' }, ...BT_STATUS_CODES];

function fmtDate(iso?: string | null): string {
  return iso ? formatDateValue(iso, undefined, LIST_DATE_OPTIONS) : '—';
}

function slabsLabel(t: BinTransferRecord): string {
  return `${t.slabCount} slab${t.slabCount === 1 ? '' : 's'}`;
}

export function BinTransferTable({ emptyAction }: { emptyAction?: () => void }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [statusCode, setStatusCode] = useState('');
  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(term.trim()); setCursor(''); setPrevCursors([]); }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [term]);

  const req: BinTransferSearchRequest = {
    search: debounced || undefined,
    filters: statusCode ? [{ field: 'status_code', op: 'eq', value: statusCode }] : [],
    sort: [{ field: 'created_at', dir: 'desc' }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['bin-transfers', req],
    queryFn: () => binTransferService.search(req),
    placeholderData: (prev) => prev,
  });

  const records = data?.records ?? [];
  const hasMore = data?.hasMore ?? false;
  const hasPrev = prevCursors.length > 0;
  const filtered = Boolean(debounced) || Boolean(statusCode);

  function pickStatus(code: string) { setStatusCode(code); setCursor(''); setPrevCursors([]); }
  function clear() { setTerm(''); pickStatus(''); }
  function goNext() { if (!data?.nextCursor) return; setPrevCursors((p) => [...p, cursor]); setCursor(data.nextCursor); }
  function goPrev() { const prev = prevCursors[prevCursors.length - 1] ?? ''; setPrevCursors((p) => p.slice(0, -1)); setCursor(prev); }

  async function handleDownloadCsv() {
    setExporting(true);
    setExportError(null);
    try {
      await exportPagedCsv(
        (exportCursor) => binTransferService.search({ ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor }),
        ['Number', 'Status', 'Location', 'Slabs', 'Area', 'Destination', 'Requested By', 'Date', 'Completed'],
        (t) => [
          t.number, t.statusName, t.warehouseName ?? '', String(t.slabCount), t.totalArea.toFixed(2),
          t.toBinSummary ?? '', t.ownerName ?? '', t.date, t.completedAt ?? '',
        ],
        'Bin Transfer',
      );
    } catch (err) {
      setExportError(apiErrorMessage(err));
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Filter by status">
          {CHIPS.map((c) => (
            <button
              key={c.code || 'all'}
              type="button"
              onClick={() => pickStatus(c.code)}
              aria-pressed={statusCode === c.code}
              className={cn(
                'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                statusCode === c.code
                  ? 'border-stone-900 bg-stone-900 text-white'
                  : 'border-stone-200 bg-white text-stone-600 hover:bg-stone-50',
              )}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:ml-2 sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-stone-400" aria-hidden="true" />
          <input
            type="text"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search number, slab serial, location…"
            aria-label="Search bin transfers"
            className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-500 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30"
          />
        </div>

        {filtered && (
          <button type="button" onClick={clear} className="flex h-8 items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 text-xs text-stone-500 transition-colors hover:bg-stone-50">
            <X className="size-3" /> Clear
          </button>
        )}
        {records.length > 0 && (
          <button
            type="button"
            onClick={handleDownloadCsv}
            disabled={exporting}
            aria-label="Download bin transfers as CSV"
            className="ml-auto flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:opacity-50"
          >
            {exporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {exporting ? 'Exporting…' : 'Download CSV'}
          </button>
        )}
      </div>

      {isError && <p role="alert" className="text-xs text-red-500">{apiErrorMessage(error, 'Failed to load bin transfers.')}</p>}
      {exportError && <p role="alert" className="text-xs text-red-500">Failed to export CSV: {exportError}</p>}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[820px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                {['Number', 'Location', 'Slabs', 'Destination', 'Status', 'Requested by', 'Date'].map((h) => (
                  <th key={h} className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>
                    {Array.from({ length: COLUMN_COUNT }, (_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-3 w-16 animate-pulse rounded bg-stone-100" /></td>
                    ))}
                  </tr>
                ))
              ) : records.length > 0 ? (
                records.map((t) => (
                  <tr
                    key={t.id}
                    onClick={() => navigate(`/inventory/bin_transfer/${t.id}`)}
                    className="cursor-pointer transition-colors hover:bg-accent/10"
                  >
                    <td className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); navigate(`/inventory/bin_transfer/${t.id}`); }}
                        className="font-mono font-semibold text-stone-900 transition-colors hover:text-accent-foreground"
                      >
                        {t.number || '—'}
                      </button>
                    </td>
                    <td className="px-4 py-3.5 text-stone-700">{t.warehouseName || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-stone-700 tabular-nums">
                      {slabsLabel(t)}
                      <span className="ml-1 text-stone-500">· {t.totalArea.toFixed(2)}</span>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3.5 text-stone-600">{t.toBinSummary || '—'}</td>
                    <td className="px-4 py-3.5"><Badge color={BT_STATUS_COLORS[t.statusCode] ?? '#a8a29e'}>{t.statusName}</Badge></td>
                    <td className="max-w-[160px] truncate px-4 py-3.5 text-stone-600">{t.ownerName || '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3.5 text-stone-500 tabular-nums">{fmtDate(t.date)}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={COLUMN_COUNT} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-2xl bg-stone-100 p-4"><ArrowLeftRight className="size-6 text-stone-400" aria-hidden="true" /></div>
                      <p className="text-sm font-semibold text-stone-700">
                        {filtered ? 'No bin transfers match the current filters.' : 'No bin transfers yet.'}
                      </p>
                      {!filtered && emptyAction && (
                        <>
                          <p className="max-w-xs text-xs text-stone-500">Move slabs between bins with a trail of who asked, who approved and when.</p>
                          <button
                            type="button"
                            onClick={emptyAction}
                            className="rounded-lg bg-brand px-3.5 py-1.5 text-xs font-semibold text-stone-950 shadow-sm transition hover:bg-brand-hover active:scale-95"
                          >
                            New Bin Transfer
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {records.length > 0 && (
          <div className="flex items-center justify-between border-t border-stone-100 bg-stone-50/40 px-4 py-3">
            <p className="text-xs text-stone-500">{hasMore ? '' : 'Last page'}</p>
            <div className="flex items-center gap-1.5">
              <button onClick={goPrev} disabled={!hasPrev} aria-label="Previous page" className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40">
                <ChevronLeft className="size-3.5" />Previous
              </button>
              <button onClick={goNext} disabled={!hasMore} aria-label="Next page" className="flex h-8 items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-3 text-xs font-medium text-stone-600 transition-colors hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-40">
                Next<ChevronRight className="size-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
