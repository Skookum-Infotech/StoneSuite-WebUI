import { Select } from '@/components/ui/select';
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Search, X, Layers, ChevronLeft, ChevronRight, Download, Loader2, Scissors, AlertTriangle, CheckCircle2, UserCheck, UserX,
} from 'lucide-react';
import { apiErrorMessage } from '@/api/tenantClient';
import { inventoryUnitService } from '@/services/inventoryUnitService';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { exportPagedCsv } from '@/lib/csvExport';
import { customerReservationOf, isAllocated } from '@/lib/unitAllocation';
import { formatUnitArea, usageOf } from '@/lib/unitConsumption';
import { UNIT_STATUS_AVAILABLE, UNIT_STATUS_RESERVED, UNIT_STATUS_CONSUMED, UNIT_STATUS_SCRAPPED, UNIT_STATUS_IN_TRANSIT, UNIT_STATUS_ON_ORDER, UNIT_STATUS_RECEIVED } from '@/types/inventory';
import type { InventoryUnit, UnitSearchRequest } from '@/types/inventory';
import { ScrapUnitDialog } from './ScrapUnitDialog';
import { CutUnitDialog } from './CutUnitDialog';
import { ReserveUnitDialog } from './ReserveUnitDialog';
import { UnitAllocationChips } from './UnitAllocationChips';
import { UnitConsumptionCell } from './UnitConsumptionCell';

import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { StatusPill } from '@/components/ui/StatusPill';
const EXPORT_PAGE_SIZE = 200;
const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: '', label: 'Any status' },
  { value: UNIT_STATUS_AVAILABLE, label: 'Available' },
  { value: UNIT_STATUS_RECEIVED, label: 'Received' },
  { value: UNIT_STATUS_RESERVED, label: 'Reserved' },
  { value: UNIT_STATUS_CONSUMED, label: 'Consumed' },
  { value: UNIT_STATUS_SCRAPPED, label: 'Scrapped' },
  { value: UNIT_STATUS_IN_TRANSIT, label: 'In Transit' },
  { value: UNIT_STATUS_ON_ORDER, label: 'On Order' },
];

const STATUS_COLORS: Record<string, string> = {
  available: '#22c55e',
  received: '#06b6d4',
  reserved: '#f59e0b',
  consumed: '#64748b',
  scrapped: '#ef4444',
  in_transit: '#6366f1',
  on_order: '#8b5cf6',
};

export function UnitTable() {
  const topRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
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

  const [scrapTarget, setScrapTarget] = useState<InventoryUnit | null>(null);
  const [cutTarget, setCutTarget] = useState<InventoryUnit | null>(null);
  const [cutMessage, setCutMessage] = useState<string | null>(null);
  const [reserveTarget, setReserveTarget] = useState<InventoryUnit | null>(null);
  const [reserveMessage, setReserveMessage] = useState<string | null>(null);

  const { mutate: releaseReservation, isPending: isReleasing, error: releaseError } = useMutation({
    mutationFn: (unit: InventoryUnit) => inventoryUnitService.release(unit.id),
    onSuccess: (_data, unit) => {
      queryClient.invalidateQueries({ queryKey: ['inventory-units'] });
      queryClient.invalidateQueries({ queryKey: ['inventory-unit', unit.id] });
      setReserveMessage(`${unit.serial} is available again.`);
    },
  });

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
        ['Serial', 'Item', 'Kind', 'Status', 'Sales Order', 'Fabrication Job', 'Area', 'Unit', 'Used', 'Recovered', 'Location', 'Bin'],
        (u) => [
          u.serial, u.inventoryItemName ?? '', u.kind, u.status,
          usageOf(u).salesOrderNumber ?? '', usageOf(u).jobNumber ?? '',
          u.area.toFixed(2), u.areaUnitCode ?? '',
          usageOf(u).usedArea.toFixed(2), usageOf(u).recoveredArea.toFixed(2), u.warehouseName ?? '', u.binPath ?? '',
        ],
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
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-ink-faint" />
          <input type="text" placeholder="Search serial, barcode, lot, SKU…" value={term} onChange={(e) => setTerm(e.target.value)} className="h-8 w-full rounded-lg border border-stone-200 bg-white pl-8 pr-3 placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand transition-all type-input" />
        </div>
        <Select value={status} onChange={(e) => { setStatus(e.target.value); setCursor(''); setPrevCursors([]); }} aria-label="Filter by status" className="h-8 rounded-lg border border-stone-200 bg-white px-2.5 text-xs text-ink">
          {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </Select>
        <Select value={kind} onChange={(e) => { setKind(e.target.value); setCursor(''); setPrevCursors([]); }} aria-label="Filter by kind" className="h-8 rounded-lg border border-stone-200 bg-white px-2.5 text-xs text-ink">
          <option value="">Any kind</option>
          <option value="slab">Slab</option>
          <option value="remnant">Remnant</option>
        </Select>
        {hasFilters && (
          <button onClick={clearFilters} className={cn(buttonVariants({ variant: 'outline' }), 'flex')}>
            <X className="size-3" /> Clear
          </button>
        )}
        {records.length > 0 && (
          <button type="button" onClick={handleDownloadCsv} disabled={isExporting} aria-label="Download units as CSV" className={cn(buttonVariants({ variant: 'outline' }), 'ml-auto flex')}>
            {isExporting ? <Loader2 className="size-3.5 animate-spin" /> : <Download className="size-3.5" />}
            {isExporting ? 'Exporting…' : 'Download CSV'}
          </button>
        )}
      </div>

      {isError && <p className="type-error">{apiErrorMessage(error, 'Failed to load units.')}</p>}
      {exportError && <p className="type-error">Failed to export CSV: {exportError}</p>}
      {releaseError && <p role="alert" className="type-error">{apiErrorMessage(releaseError, 'Failed to release the reservation.')}</p>}
      {reserveMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <p className="flex-1 text-xs text-success-ink">{reserveMessage}</p>
          <button type="button" onClick={() => setReserveMessage(null)} aria-label="Dismiss" className="shrink-0 rounded p-0.5 text-success-ink hover:bg-emerald-100">
            <X className="size-3.5" />
          </button>
        </div>
      )}
      {cutMessage && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-emerald-600" />
          <p className="flex-1 text-xs text-success-ink">{cutMessage}</p>
          <button type="button" onClick={() => setCutMessage(null)} aria-label="Dismiss" className="shrink-0 rounded p-0.5 text-success-ink hover:bg-emerald-100">
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="overflow-x-auto modal-scrollbar">
          <table className="w-full min-w-[1180px] text-left type-cell">
            <thead className="border-b border-stone-200 bg-table-header">
              <tr>
                <th className="px-4 py-3 type-th">Serial</th>
                <th className="px-4 py-3 type-th">Item</th>
                <th className="px-4 py-3 type-th">Kind</th>
                <th className="px-4 py-3 type-th">Status</th>
                <th className="px-4 py-3 type-th">Allocated To</th>
                <th className="px-4 py-3 text-right type-th">Area</th>
                <th className="px-4 py-3 type-th">Consumption</th>
                <th className="px-4 py-3 type-th">Location</th>
                {canUpdate && <th className="px-4 py-3 text-right type-th">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {isLoading ? (
                Array.from({ length: 5 }, (_, i) => (
                  <tr key={i}>{Array.from({ length: canUpdate ? 9 : 8 }, (_, j) => <td key={j} className="px-4 py-2.5"><div className="animate-pulse h-3 rounded bg-stone-100 w-16" /></td>)}</tr>
                ))
              ) : records.length > 0 ? (
                records.map((u) => {
                  const inTransit = u.status === UNIT_STATUS_IN_TRANSIT;
                  const received = u.status === UNIT_STATUS_RECEIVED;
                  const heldForCustomer = customerReservationOf(u) !== null;
                  const disabledReason = inTransit
                    ? 'This unit is in transit between locations.'
                    : received
                      ? 'This unit has no bin yet — move it to a bin first.'
                      : u.status !== UNIT_STATUS_AVAILABLE ? `Unit is ${u.status.replace('_', ' ')}.` : undefined;
                  // A slab that has arrived but has no bin can still be written off.
                  const scrapDisabledReason = received ? undefined : disabledReason;
                  return (
                    <tr key={u.id} className="group hover:bg-accent/10 transition-colors duration-150">
                      <td className="px-4 py-2.5">
                        <Link to={`/inventory/unit/${u.id}`} className="whitespace-nowrap hover:text-accent-foreground transition-colors type-record-id">{u.serial}</Link>
                      </td>
                      <td className="px-4 py-2.5 truncate max-w-[180px] type-cell">{u.inventoryItemName ?? '—'}</td>
                      <td className="px-4 py-2.5 capitalize type-cell">{u.kind}</td>
                      <td className="px-4 py-2.5">
                        <StatusPill color={STATUS_COLORS[u.status] ?? '#a8a29e'}>{u.status.replace('_', ' ')}</StatusPill>
                      </td>
                      <td className="px-4 py-2.5">
                        {isAllocated(u) ? <UnitAllocationChips unit={u} /> : <span className="text-ink-muted" aria-label="Not allocated">—</span>}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-right whitespace-nowrap type-cell">{formatUnitArea(u.area, u.areaUnitCode)}</td>
                      <td className="px-4 py-2.5"><UnitConsumptionCell unit={u} /></td>
                      <td className="px-4 py-2.5 truncate max-w-[160px] type-cell">{u.binPath || u.warehouseName || '—'}</td>
                      {canUpdate && (
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-end gap-1.5">
                            {heldForCustomer ? (
                              <button type="button" disabled={isReleasing} onClick={() => releaseReservation(u)} aria-label={`Release reservation on ${u.serial}`} title="Give this slab back to available stock" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                                <UserX className="size-3.5" /> Release
                              </button>
                            ) : (
                              <button type="button" disabled={u.status !== UNIT_STATUS_AVAILABLE} onClick={() => setReserveTarget(u)} aria-label={`Reserve ${u.serial} for a customer`} title={u.status === UNIT_STATUS_AVAILABLE ? 'Reserve for a customer' : `Reserve — ${disabledReason ?? `unit is ${u.status.replace('_', ' ')}`}`} className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                                <UserCheck className="size-3.5" /> Reserve
                              </button>
                            )}
                            <button type="button" disabled={Boolean(disabledReason) || u.kind !== 'slab' && u.kind !== 'remnant'} onClick={() => setCutTarget(u)} aria-label={`Cut ${u.serial}`} title={disabledReason ? `Cut — ${disabledReason}` : u.kind !== 'slab' && u.kind !== 'remnant' ? 'Cut — only available for slabs and remnants' : 'Cut'} className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-ink-muted hover:bg-accent hover:border-accent hover:text-accent-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                              <Scissors className="size-3.5" />
                            </button>
                            <button type="button" disabled={Boolean(scrapDisabledReason)} onClick={() => setScrapTarget(u)} aria-label={`Scrap ${u.serial}`} title={scrapDisabledReason ? `Scrap — ${scrapDisabledReason}` : 'Scrap'} className="inline-flex items-center justify-center rounded-lg border border-stone-200 bg-white p-2 text-ink-muted hover:bg-destructive/10 hover:border-destructive/30 hover:text-danger-ink disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
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
                  <td colSpan={8 + (canUpdate ? 1 : 0)} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="rounded-2xl bg-stone-100 p-4"><Layers className="size-6 text-ink-faint" /></div>
                      <p className="type-card-title">{hasFilters ? 'No units match the current search.' : 'No slabs in stock yet — receive a purchase order to add some.'}</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {records.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-stone-100 bg-stone-50/40">
            <p className="tabular-nums type-helper">{hasMore ? '' : 'Last page'}</p>
            <div className="flex items-center gap-1.5">
              <button onClick={goPrev} disabled={!hasPrev} className={cn(buttonVariants({ variant: 'outline' }), 'flex')} aria-label="Previous page"><ChevronLeft className="size-3.5" />Previous</button>
              <button onClick={goNext} disabled={!hasMore} className={cn(buttonVariants({ variant: 'outline' }), 'flex')} aria-label="Next page">Next<ChevronRight className="size-3.5" /></button>
            </div>
          </div>
        )}
      </div>

      {reserveTarget && (
        <ReserveUnitDialog
          unit={reserveTarget}
          onClose={() => setReserveTarget(null)}
          onReserved={(customerName) => setReserveMessage(`${reserveTarget.serial} is reserved for ${customerName}.`)}
        />
      )}
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
