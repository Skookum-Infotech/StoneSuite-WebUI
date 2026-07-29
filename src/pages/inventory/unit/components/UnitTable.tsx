import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Search, X, Layers, ChevronLeft, ChevronRight, Download, Loader2, ArrowLeftRight, Scissors, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { exportPagedCsv } from '@/lib/csvExport';
import { UNIT_STATUS_AVAILABLE, UNIT_STATUS_RESERVED, UNIT_STATUS_CONSUMED, UNIT_STATUS_SCRAPPED, UNIT_STATUS_IN_TRANSIT } from '@/types/inventory';
import type { InventoryUnit, UnitSearchRequest } from '@/types/inventory';
import { MoveUnitDialog } from './MoveUnitDialog';
import { ScrapUnitDialog } from './ScrapUnitDialog';
import { CutUnitDialog } from './CutUnitDialog';

const EXPORT_PAGE_SIZE = 200;
const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: UNIT_STATUS_AVAILABLE, label: 'Available' },
  { value: UNIT_STATUS_RESERVED, label: 'Reserved' },
  { value: UNIT_STATUS_CONSUMED, label: 'Consumed' },
  { value: UNIT_STATUS_SCRAPPED, label: 'Scrapped' },
  { value: UNIT_STATUS_IN_TRANSIT, label: 'In Transit' },
];

const STATUS_COLORS: Record<string, string> = {
  available: '#22c55e',
  reserved: '#f59e0b',
  consumed: '#64748b',
  scrapped: '#ef4444',
  in_transit: '#6366f1',
};

export function UnitTable() {
  const navigate = useNavigate();
  const topRef = useRef<HTMLDivElement>(null);
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canUpdate = permissionsLoading || hasPermission('inventory_unit', 'update');

  const [term, setTerm] = useState('');
  const [debounced, setDebounced] = useState('');
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [cursor, setCursor] = useState('');
  const [prevCursors, setPrevCursors] = useState<string[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [moveTarget, setMoveTarget] = useState<InventoryUnit | null>(null);
  const [scrapTarget, setScrapTarget] = useState<InventoryUnit | null>(null);
  const [cutTarget, setCutTarget] = useState<InventoryUnit | null>(null);
  const [cutMessage, setCutMessage] = useState<string | null>(null);

  useEffect(() => {
    const t = setTimeout(() => { setDebounced(term.trim()); setCursor(''); setPrevCursors([]); }, 300);
    return () => clearTimeout(t);
  }, [term]);

  const filters = [
    ...(status ? [{ field: 'status', op: 'eq' as const, value: status }] : []),
    ...(kind ? [{ field: 'kind', op: 'eq' as const, value: kind }] : []),
  ];

  const req: UnitSearchRequest = {
    search: debounced || undefined,
    filters,
    sort: [{ field: 'serial', dir: 'asc' }],
    limit: PAGE_SIZE,
    cursor: cursor || undefined,
  };

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['inventory-units', req],
    queryFn: () => inventoryUnitService.searchUnits(req),
    placeholderData: (prev) => prev,
  });

  const records = data?.records ?? [];
  const hasMore = data?.hasMore ?? false;
  const hasPrev = prevCursors.length > 0;
  const hasFilters = Boolean(term) || Boolean(status) || Boolean(kind);

  function scrollToTop() { topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function goNext() { if (!data?.nextCursor) return; setPrevCursors((p) => [...p, cursor]); setCursor(data.nextCursor); scrollToTop(); }
  function goPrev() { const prev = prevCursors[prevCursors.length - 1] ?? ''; setPrevCursors((p) => p.slice(0, -1)); setCursor(prev); scrollToTop(); }
  function clearFilters() { setTerm(''); setStatus(''); setKind(''); setCursor(''); setPrevCursors([]); }

  async function handleDownloadCsv() {
    setIsExporting(true);
    setExportError(null);
    try {
      await exportPagedCsv(
        (exportCursor) => inventoryUnitService.searchUnits({ ...req, limit: EXPORT_PAGE_SIZE, cursor: exportCursor }),
        ['Serial', 'Item', 'Kind', 'Status', 'Area', 'Warehouse', 'Bin'],
        (u) => [u.serial, u.inventoryItemName ?? '', u.kind, u.status, u.area.toFixed(2), u.warehouseName ?? '', u.binPath ?? ''],
        'Inventory Unit',
      );
    } catch (err) {
      setExportError(apiErrorMessage(err));
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <div ref={topRef} className="flex flex-col gap-3 scroll-mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-stone-400" />
          <input type="text" placeholder="Search serial, barcode, lot, SKU…" value={term} onChange={(e) => setTerm(e.target.value)} className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 text-xs text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all" />
        </div>
        <select value={status} onChange={(e) => { setStatus(e.target.value); setCursor(''); setPrevCursors([]); }} aria-label="Filter by status" className="h-8 rounded-lg border border-stone-200 bg-white px-2.5 text-xs text-stone-600">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <select value={kind} onChange={(e) => { setKind(e.target.value); setCursor(''); setPrevCursors([]); }} aria-label="Filter by kind" className="h-8 rounded-lg border border-stone-200 bg-white px-2.5 text-xs text-stone-600">
          <option value="">Any kind</option>
          <option value="slab">Slab</option>
          <option value="remnant">Remnant</option>
        </select>
        {hasFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs text-stone-500 hover:bg-stone-50 transition-colors">
            <X className="size-3" /> Clear
          </button>
        )}
        {records.length > 0 && (
          <button type="button" onClick={handleDownloadCsv} disabled={isExporting} aria-label="Download units as CSV" className="ml-auto flex items-center gap-1.5 rounded-lg border border-stone-200 bg-white px-2.5 h-8 text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-50 transition-colors">
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : 'Download CSV'}
          </button>
        )}
      </div>

      {isError && <p className="text-xs text-red-500">{apiErrorMessage(error, 'Failed to load units.')}</p>}
      {exportError && <p className="text-xs text-red-500">Failed to export CSV: {exportError}</p>}
      {cutMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <p className="flex-1 text-xs text-emerald-700">{cutMessage}</p>
          <button type="button" onClick={() => setCutMessage(null)} aria-label="Dismiss" className="shrink-0 rounded p-0.5 text-emerald-500 hover:bg-emerald-100">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[900px] text-left text-xs">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Serial</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Item</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Kind</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Status</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Area</th>
                <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500">Location</th>
                {canUpdate && <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-stone-500 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>{Array.from({ length: canUpdate ? 7 : 6 }, (_, j) => <td key={j} className="px-4 py-3"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>)}</tr>
                ))
              ) : records.length > 0 ? (
                records.map((u) => {
                  const inTransit = u.status === UNIT_STATUS_IN_TRANSIT;
                  const disabledReason = inTransit ? 'This unit is in transit between warehouses.' : u.status !== UNIT_STATUS_AVAILABLE ? `Unit is ${u.status}.` : undefined;
                  return (
                    <tr key={u.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 py-3.5">
                        <button type="button" onClick={() => navigate(`/inventory/unit/${u.id}`)} className="font-mono text-xs font-semibold text-stone-900 hover:text-accent-foreground transition-colors">{u.serial}</button>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-700 truncate max-w-[180px]">{u.inventoryItemName ?? '—'}</td>
                      <td className="px-4 py-3.5 text-xs text-stone-500 capitalize">{u.kind}</td>
                      <td className="px-4 py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold text-stone-600 whitespace-nowrap" style={{ backgroundColor: `${STATUS_COLORS[u.status] ?? '#a8a29e'}18` }}>
                          <span className="size-1.5 shrink-0 rounded-full" style={{ backgroundColor: STATUS_COLORS[u.status] ?? '#a8a29e' }} aria-hidden="true" />
                          {u.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 text-xs text-stone-700 tabular-nums text-right">{u.area.toFixed(2)}</td>
                      <td className="px-4 py-3.5 text-xs text-stone-500 truncate max-w-[160px]">{u.binPath || u.warehouseName || '—'}</td>
                      {canUpdate && (
                        <td className="px-4 py-3.5">
                          <div className="flex items-center justify-end gap-1.5">
                            <button type="button" disabled={Boolean(disabledReason)} onClick={() => setMoveTarget(u)} aria-label={`Move ${u.serial}`} title={disabledReason ? `Move — ${disabledReason}` : 'Move'} className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-500 hover:bg-accent hover:border-accent hover:text-accent-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              <ArrowLeftRight className="size-3.5" />
                            </button>
                            <button type="button" disabled={Boolean(disabledReason) || u.kind !== 'slab' && u.kind !== 'remnant'} onClick={() => setCutTarget(u)} aria-label={`Cut ${u.serial}`} title={disabledReason ? `Cut — ${disabledReason}` : u.kind !== 'slab' && u.kind !== 'remnant' ? 'Cut — only available for slabs and remnants' : 'Cut'} className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-500 hover:bg-accent hover:border-accent hover:text-accent-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              <Scissors className="size-3.5" />
                            </button>
                            <button type="button" disabled={Boolean(disabledReason)} onClick={() => setScrapTarget(u)} aria-label={`Scrap ${u.serial}`} title={disabledReason ? `Scrap — ${disabledReason}` : 'Scrap'} className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-stone-500 hover:bg-destructive/10 hover:border-destructive/30 hover:text-destructive disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              <AlertTriangle className="size-3.5" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6 + (canUpdate ? 1 : 0)} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-2xl bg-stone-100 p-4"><Layers className="size-6 text-stone-400" /></div>
                      <p className="text-sm font-semibold text-stone-700">{hasFilters ? 'No units match the current search.' : 'No units received yet.'}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {records.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/40">
            <p className="text-xs text-stone-500 tabular-nums">{hasMore ? '' : 'Last page'}</p>
            <div className="flex items-center gap-1.5">
              <button onClick={goPrev} disabled={!hasPrev} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Previous page"><ChevronLeft className="size-3.5" />Previous</button>
              <button onClick={goNext} disabled={!hasMore} className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-stone-200 bg-white text-xs font-medium text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors" aria-label="Next page">Next<ChevronRight className="size-3.5" /></button>
            </div>
          </div>
        )}
      </div>

      {moveTarget && <MoveUnitDialog unit={moveTarget} onClose={() => setMoveTarget(null)} onMoved={() => {}} />}
      {scrapTarget && <ScrapUnitDialog unit={scrapTarget} onClose={() => setScrapTarget(null)} onScrapped={() => {}} />}
      {cutTarget && (
        <CutUnitDialog
          unit={cutTarget}
          onClose={() => setCutTarget(null)}
          onCut={(result) => setCutMessage(`Cut complete for ${cutTarget.serial}: ${result.remnants.length} offcut(s) kept, ${result.lostArea.toFixed(2)} sq lost to kerf/product.`)}
        />
      )}
    </div>
  );
}
